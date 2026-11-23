// 교사용 저장소: 로그인한 교사의 Supabase 연결(hub.sb)로 읽고 쓴다. 권한은 DB(RLS)가 막는다.
// 화면(board.js·list.js)이 부르는 함수 이름은 학생용(api-student.js)과 같다.
import { SLUG, fileExt } from "./common.js";

const BUCKET = "moaboard-files";
const BOARD_COLS = "id, title, description, layout, needs_approval, allow_post, allow_comments, allow_like, allow_emoji, allow_files, show_names, comments_inline, bg_preset, bg_image_path, card_color, created_at, updated_at";
const POST_COLS = "id, board_id, section_id, position, student_id, by_teacher, author_name, title, body, image_path, file_path, file_name, file_size, video_path, video_name, video_size, status, created_at, " +
  "moaboard_comments(id, by_teacher, author_name, body, created_at), moaboard_reactions(actor_id, kind)";
const EDITABLE = ["title", "description", "layout", "needs_approval", "allow_post", "allow_comments", "allow_like", "allow_emoji", "allow_files", "show_names", "comments_inline", "bg_preset", "bg_image_path", "card_color"];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const must = ({ data, error }) => { if (error) throw error; return data; };

export function createTeacherApi(hub) {
  const sb = hub.sb, me = hub.user.id;
  let current = null;          // 지금 연 보드 id
  let last = null;             // 마지막으로 읽은 보드(반응 켜고 끄기·옮기기에 씀)
  const urlCache = new Map();  // 파일 경로 → { url, until }

  async function signed(paths) {
    const now = Date.now(), need = [...new Set(paths)].filter((p) => p && !(urlCache.get(p)?.until > now));
    if (need.length) {
      const { data } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
      for (const u of data ?? []) if (u.signedUrl) urlCache.set(u.path, { url: u.signedUrl, until: now + 50 * 60e3 });
    }
    return (p) => (p ? urlCache.get(p)?.url ?? null : null);
  }
  const removeFiles = async (paths) => {
    const list = paths.filter(Boolean);
    if (list.length) await sb.storage.from(BUCKET).remove(list);   // 학생 파일도 교사 폴더(<교사 id>/…) 아래라 교사가 지울 수 있어요
  };
  const subs = new Set();
  let kickT = null;
  /** 바꾼 뒤 화면을 바로 다시 그려요(실시간 알림을 기다리지 않음). 여러 번 불러도 한 번만 */
  const changed = () => { clearTimeout(kickT); kickT = setTimeout(() => subs.forEach((fn) => fn()), 120); };
  const record = (b) => hub.recordActivity({ appSlug: SLUG, contentId: b.id, title: b.title.slice(0, 100), url: `/moaboard/?c=${b.id}` });

  const api = {
    // ---- 보드 ----
    async listBoards() {
      const [boards, counts] = await Promise.all([
        sb.from("moaboard_boards").select(BOARD_COLS).order("updated_at", { ascending: false }).limit(200).then(must),
        sb.rpc("moaboard_board_counts").then(must),
      ]);
      const by = new Map((counts ?? []).map((c) => [c.board_id, c]));
      const url = await signed(boards.map((b) => b.bg_image_path));
      return boards.map((b) => ({ ...b, bg_image: url(b.bg_image_path), post_count: Number(by.get(b.id)?.post_count ?? 0), pending_count: Number(by.get(b.id)?.pending_count ?? 0) }));
    },
    async getBoard(id) {
      const first = current !== id;
      current = id;
      const board = must(await sb.from("moaboard_boards").select(BOARD_COLS).eq("id", id).maybeSingle());
      if (!board) return null;
      const [sections, rows] = await Promise.all([
        sb.from("moaboard_sections").select("id, board_id, title, position").eq("board_id", id).order("position").then(must),
        sb.from("moaboard_posts").select(POST_COLS).eq("board_id", id).order("created_at").limit(1000).then(must),
      ]);
      const url = await signed([board.bg_image_path, ...rows.flatMap((p) => [p.image_path, p.file_path, p.video_path])]);
      board.bg_image = url(board.bg_image_path);
      const posts = rows.map((p) => {
        const rx = p.moaboard_reactions ?? [], emojis = {};
        for (const r of rx) if (r.kind !== "like") emojis[r.kind] = (emojis[r.kind] || 0) + 1;
        return {
          id: p.id, board_id: p.board_id, section_id: p.section_id, position: p.position, title: p.title, body: p.body,
          author: p.author_name, by_teacher: p.by_teacher, mine: p.by_teacher, status: p.status, created_at: p.created_at,
          image: url(p.image_path), image_path: p.image_path,
          file: p.file_path ? { name: p.file_name, size: p.file_size ?? 0, url: url(p.file_path), path: p.file_path } : null,
          video: p.video_path ? { name: p.video_name || "영상", size: p.video_size ?? 0, url: url(p.video_path), path: p.video_path } : null,
          likes: rx.filter((r) => r.kind === "like").length, liked: rx.some((r) => r.kind === "like" && r.actor_id === me),
          emojis, my_emojis: rx.filter((r) => r.kind !== "like" && r.actor_id === me).map((r) => r.kind),
          comments: (p.moaboard_comments ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((c) => ({ id: c.id, author: c.author_name, body: c.body, by_teacher: c.by_teacher, mine: c.by_teacher, created_at: c.created_at })),
        };
      });
      last = { board, sections, posts };
      if (first) record(board);          // 열 때 "내가 만든 활동"의 최근 사용 시각
      return structuredClone(last);
    },
    async createBoard(v) {
      const b = must(await sb.from("moaboard_boards").insert({ teacher_id: me, ...pick(v, EDITABLE) }).select(BOARD_COLS).single());
      if (b.layout !== "wall") must(await sb.from("moaboard_sections").insert({ board_id: b.id, title: "첫 번째 칸", position: 0 }));
      await record(b);
      return b;
    },
    async updateBoard(id, v) {
      const oldBg = last?.board?.id === id ? last.board.bg_image_path : null;
      const b = must(await sb.from("moaboard_boards").update(pick(v, EDITABLE)).eq("id", id).select(BOARD_COLS).single());
      if (oldBg && oldBg !== b.bg_image_path) await removeFiles([oldBg]);   // 바꾸거나 뺀 배경 사진은 지워요
      if (b.layout !== "wall" && !(last?.sections?.length)) must(await sb.from("moaboard_sections").insert({ board_id: id, title: "첫 번째 칸", position: 0 }));
      await record(b);
      changed();
      return b;
    },
    async deleteBoard(id) {
      // 파일 먼저(행이 지워지면 경로를 알 수 없어요)
      const rows = must(await sb.from("moaboard_posts").select("image_path, file_path, video_path").eq("board_id", id));
      const bg = must(await sb.from("moaboard_boards").select("bg_image_path").eq("id", id).maybeSingle());
      await removeFiles([bg?.bg_image_path, ...rows.flatMap((p) => [p.image_path, p.file_path, p.video_path])]);
      must(await sb.from("moaboard_boards").delete().eq("id", id));
      await hub.removeActivity({ appSlug: SLUG, contentId: id });
    },

    // ---- 칸 ----
    async addSection(boardId, title) {
      const pos = Math.max(-1, ...(last?.sections ?? []).map((s) => s.position)) + 1;
      must(await sb.from("moaboard_sections").insert({ board_id: boardId, title, position: pos })); changed();
    },
    async renameSection(id, title) { must(await sb.from("moaboard_sections").update({ title }).eq("id", id)); changed(); },
    async deleteSection(id) { must(await sb.from("moaboard_sections").delete().eq("id", id)); changed(); },   // 글은 DB 가 '칸 없음'으로
    async moveSection(id, dir) {
      const list = (last?.sections ?? []).slice().sort((a, b) => a.position - b.position);
      const i = list.findIndex((s) => s.id === id), j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      await Promise.all(list.map((s, k) => {
        const pos = k === i ? j : k === j ? i : k;
        return s.position === pos ? null : sb.from("moaboard_sections").update({ position: pos }).eq("id", s.id).then(must);
      }));
      changed();
    },

    // ---- 글 ----
    async createPost(boardId, v) {
      const sec = v.section_id ?? null;
      const pos = Math.max(-1, ...(last?.posts ?? []).filter((p) => p.section_id === sec).map((p) => p.position)) + 1;
      must(await sb.from("moaboard_posts").insert({ board_id: boardId, section_id: sec, position: pos, by_teacher: true, author_name: "선생님",
        title: v.title, body: v.body, image_path: v.image_path ?? null,
        file_path: v.file?.path ?? null, file_name: v.file?.name ?? null, file_size: v.file?.size ?? null,
        video_path: v.video?.path ?? null, video_name: v.video?.path ? v.video.name : null, video_size: v.video?.path ? v.video.size : null }));
      changed();
    },
    async updatePost(id, v) {
      const old = last?.posts.find((p) => p.id === id);
      const patch = { title: v.title, body: v.body, section_id: v.section_id ?? null, image_path: v.image_path ?? null,
        file_path: v.file?.path ?? null, file_name: v.file?.name ?? null, file_size: v.file?.size ?? null,
        video_path: v.video?.path ?? null, video_name: v.video?.path ? v.video.name : null, video_size: v.video?.path ? v.video.size : null };
      must(await sb.from("moaboard_posts").update(patch).eq("id", id));
      if (old) await removeFiles([old.image_path !== patch.image_path && old.image_path, old.file?.path !== patch.file_path && old.file?.path, old.video?.path !== patch.video_path && old.video?.path]);
      changed();
    },
    async deletePost(id) {
      const old = last?.posts.find((p) => p.id === id);
      must(await sb.from("moaboard_posts").delete().eq("id", id));
      if (old) await removeFiles([old.image_path, old.file?.path, old.video?.path]);
      changed();
    },
    async approvePost(id) { must(await sb.from("moaboard_posts").update({ status: "visible" }).eq("id", id)); changed(); },
    async movePost(id, sectionId, beforeId) {
      const posts = last?.posts ?? [];
      const p = posts.find((x) => x.id === id);
      if (!p) return;
      const list = posts.filter((x) => x.section_id === sectionId && x.id !== id).sort((a, b) => a.position - b.position);
      const at = beforeId ? list.findIndex((x) => x.id === beforeId) : -1;
      list.splice(at < 0 ? list.length : at, 0, p);
      await Promise.all(list.map((x, i) => (x.position === i && x.section_id === sectionId ? null
        : sb.from("moaboard_posts").update({ section_id: sectionId, position: i }).eq("id", x.id).then(must))));
      changed();
    },

    // ---- 반응·댓글 ----
    async toggleLike(id) { return toggle(id, "like"); },
    async toggleEmoji(id, e) { return toggle(id, e); },
    async addComment(postId, body) { must(await sb.from("moaboard_comments").insert({ post_id: postId, by_teacher: true, author_name: "선생님", body })); changed(); },
    async deleteComment(_postId, commentId) { must(await sb.from("moaboard_comments").delete().eq("id", commentId)); changed(); },

    // ---- 파일 ----
    async uploadFile(file) {
      if (!current) throw new Error("보드를 먼저 열어 주세요");
      const ext = fileExt(file.name) === "jpeg" ? "jpg" : fileExt(file.name);
      const path = `${me}/${current}/t/${crypto.randomUUID()}.${ext}`;
      must(await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false }));
      return { name: file.name, size: file.size, path, url: URL.createObjectURL(file) };
    },

    // ---- 실시간 반영: 이 보드의 바뀐 행이 오면 다시 읽어요(여러 개가 한꺼번에 오면 한 번만) ----
    subscribe(fn) {
      subs.add(fn);
      const kick = changed;
      const ch = sb.channel(`moaboard:${current}:${Math.random().toString(36).slice(2, 8)}`);
      for (const table of ["moaboard_posts", "moaboard_sections"]) ch.on("postgres_changes", { event: "*", schema: "public", table, filter: `board_id=eq.${current}` }, kick);
      ch.on("postgres_changes", { event: "*", schema: "public", table: "moaboard_boards", filter: `id=eq.${current}` }, kick);
      for (const table of ["moaboard_comments", "moaboard_reactions"]) ch.on("postgres_changes", { event: "*", schema: "public", table }, kick);
      ch.subscribe();
      // 실시간 연결이 끊겨도 30초마다 한 번은 다시 읽어요(화면이 보일 때만)
      const poll = setInterval(() => { if (!document.hidden) fn(); }, 30e3);
      return () => { subs.delete(fn); clearInterval(poll); sb.removeChannel(ch); };
    },
  };

  async function toggle(id, kind) {
    const p = last?.posts.find((x) => x.id === id);
    const on = kind === "like" ? p?.liked : p?.my_emojis.includes(kind);
    if (on) must(await sb.from("moaboard_reactions").delete().eq("post_id", id).eq("actor_id", me).eq("kind", kind));
    else must(await sb.from("moaboard_reactions").insert({ post_id: id, actor_id: me, kind }));
    changed();
  }
  return api;
}
