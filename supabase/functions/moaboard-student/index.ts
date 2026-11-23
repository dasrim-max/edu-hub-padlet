// 모아보드 학생 쪽. 학생은 DB 를 직접 쓰지 못하고 이 함수만 거친다(세션·참여 자격은 공통 입구 studentRequest 가 확인).
//   content_id = 보드 id                    : 그 보드 하나
//   content_id = APP_ENTRY_ID(수업 흐름 앱 전체) : "boards" 로 선생님 보드 목록 → 고른 board_id 로 나머지 action
// action
//   boards      보드 고르기 목록(APP_ENTRY_ID 일 때만)
//   board       보드·칸·글(확인 전 글은 쓴 학생에게만, 친구 이름 숨기기 반영)
//   post / edit / delete          글 쓰기·고치기·지우기(고치기·지우기는 내 글만)
//   comment / uncomment           댓글 쓰기·지우기(내 댓글만)
//   react       좋아요·이모지 켜고 끄기
//   upload_url  사진·파일·영상을 올릴 주소(내 폴더, 10분 유효)
// 쓰기 action 은 바뀐 보드(board 와 같은 모양)를 돌려준다.
import { json } from "../_shared/common.ts";
import { studentRequest } from "../_shared/student-app.ts";
import { APP_ENTRY_ID, BUCKET, LIMITS, REACTIONS, checkPost, clean, isUuid, shapeBoard, uploadPath, type Board, type PostRow } from "./logic.ts";

const SLUG = "moaboard";
const BOARD_COLS = "id, teacher_id, title, description, layout, needs_approval, allow_post, allow_comments, allow_like, allow_emoji, allow_files, show_names, comments_inline, bg_preset, bg_image_path, card_color, updated_at";
const POST_COLS = "id, board_id, section_id, position, student_id, by_teacher, author_name, title, body, image_path, file_path, file_name, file_size, video_path, video_name, video_size, status, created_at, " +
  "moaboard_comments(id, student_id, by_teacher, author_name, body, created_at), moaboard_reactions(actor_id, kind)";
const ACTIONS = ["boards", "board", "post", "edit", "delete", "comment", "uncomment", "react", "upload_url"];

Deno.serve(async (req: Request) => {
  const r = await studentRequest(req, SLUG);
  if ("res" in r) return r.res;
  const { admin, s, b, content_id } = r;
  const action = String(b.action ?? "");
  if (!ACTIONS.includes(action)) return json(req, { error: "bad_request" }, 400);
  const fail = (status: number, error: string, message: string) => json(req, { error, message }, status);
  const me = s.student_id;

  // 수업 흐름 "앱 전체"로 들어온 학생: 선생님 보드 고르기
  if (action === "boards") {
    if (content_id !== APP_ENTRY_ID) return json(req, { error: "bad_request" }, 400);
    const { data } = await admin.from("moaboard_boards").select("id, title, layout, updated_at")
      .eq("teacher_id", s.teacher_id).order("updated_at", { ascending: false }).limit(50);
    return json(req, { ok: true, boards: data ?? [] });
  }

  const boardId = content_id === APP_ENTRY_ID ? b.board_id : content_id;
  if (!isUuid(boardId)) return json(req, { error: "bad_request" }, 400);
  const { data: board } = await admin.from("moaboard_boards").select(BOARD_COLS).eq("id", boardId).eq("teacher_id", s.teacher_id).maybeSingle();
  if (!board) return fail(404, "not_found", "보드를 찾지 못했어요. 선생님께 확인해 주세요.");
  const own = { teacherId: s.teacher_id, boardId: board.id as string, studentId: me };

  async function myPost(id: unknown) {
    if (!isUuid(id)) return null;
    const { data } = await admin.from("moaboard_posts").select("id, student_id, by_teacher, image_path, file_path, video_path, status")
      .eq("id", id).eq("board_id", board!.id).maybeSingle();
    return data && !data.by_teacher && data.student_id === me ? data : null;
  }
  async function visiblePost(id: unknown) {
    if (!isUuid(id)) return null;
    const { data } = await admin.from("moaboard_posts").select("id").eq("id", id).eq("board_id", board!.id).eq("status", "visible").maybeSingle();
    return data;
  }
  async function sectionOk(id: string | null) {
    if (!id || board!.layout === "wall") return null;
    const { data } = await admin.from("moaboard_sections").select("id").eq("id", id).eq("board_id", board!.id).maybeSingle();
    return data ? id : null;
  }
  const removeFiles = (paths: (string | null | undefined)[]) => {
    const list = paths.filter((p): p is string => !!p);
    return list.length ? admin.storage.from(BUCKET).remove(list) : Promise.resolve();
  };

  if (action === "upload_url") {
    if (!board.allow_post || !board.allow_files) return fail(403, "no_files", "이 보드에는 사진·파일을 올릴 수 없어요.");
    const u = uploadPath(b, own, crypto.randomUUID());
    if (!("path" in u)) return fail(400, u.error, u.message);
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(u.path);
    if (error || !data) return fail(500, "server_error", "올릴 준비를 하지 못했어요. 잠시 후 다시 해 주세요.");
    return json(req, { ok: true, path: u.path, upload_url: data.signedUrl });
  }

  if (action === "post" || action === "edit") {
    if (!board.allow_post) return fail(403, "no_post", "지금은 글을 쓸 수 없어요.");
    const c = checkPost(b, own, board.allow_files);
    if (!("v" in c)) return fail(400, c.error, c.message);
    const status = board.needs_approval ? "pending" : "visible";
    const section_id = await sectionOk(c.v.section_id);
    if (action === "post") {
      const { count } = await admin.from("moaboard_posts").select("id", { count: "exact", head: true }).eq("board_id", board.id).eq("student_id", me);
      if ((count ?? 0) >= LIMITS.postsPerStudent) return fail(429, "too_many", "이 보드에는 더 붙일 수 없어요. 선생님께 말씀해 주세요.");
      const q = admin.from("moaboard_posts").select("position").eq("board_id", board.id);
      const { data: last } = await (section_id ? q.eq("section_id", section_id) : q.is("section_id", null))
        .order("position", { ascending: false }).limit(1).maybeSingle();
      const { error } = await admin.from("moaboard_posts").insert({ board_id: board.id, position: (last?.position ?? -1) + 1,
        student_id: me, by_teacher: false, author_name: s.student.name, ...c.v, section_id, status });
      if (error) return fail(500, "server_error", "붙이지 못했어요. 잠시 후 다시 해 주세요.");
    } else {
      const p = await myPost(b.post_id);
      if (!p) return fail(404, "not_found", "고칠 수 있는 글이 아니에요.");
      const { error } = await admin.from("moaboard_posts").update({ ...c.v, section_id, status }).eq("id", p.id);
      if (error) return fail(500, "server_error", "고치지 못했어요. 잠시 후 다시 해 주세요.");
      await removeFiles([p.image_path !== c.v.image_path ? p.image_path : null, p.file_path !== c.v.file_path ? p.file_path : null, p.video_path !== c.v.video_path ? p.video_path : null]);
    }
  } else if (action === "delete") {
    const p = await myPost(b.post_id);
    if (!p) return fail(404, "not_found", "지울 수 있는 글이 아니에요.");
    await admin.from("moaboard_posts").delete().eq("id", p.id);
    await removeFiles([p.image_path, p.file_path, p.video_path]);
  } else if (action === "comment") {
    if (!board.allow_comments) return fail(403, "no_comments", "이 보드에는 댓글을 쓸 수 없어요.");
    const body = clean(b.body);
    if (body.length < 1 || body.length > LIMITS.comment) return fail(400, "bad_body", `댓글은 1~${LIMITS.comment}자로 써 주세요.`);
    const p = await visiblePost(b.post_id);
    if (!p) return fail(404, "not_found", "글을 찾지 못했어요.");
    const { count } = await admin.from("moaboard_comments").select("id, moaboard_posts!inner(board_id)", { count: "exact", head: true })
      .eq("student_id", me).eq("moaboard_posts.board_id", board.id);
    if ((count ?? 0) >= LIMITS.commentsPerStudent) return fail(429, "too_many", "댓글을 더 쓸 수 없어요.");
    const { error } = await admin.from("moaboard_comments").insert({ post_id: p.id, student_id: me, by_teacher: false, author_name: s.student.name, body });
    if (error) return fail(500, "server_error", "댓글을 쓰지 못했어요. 잠시 후 다시 해 주세요.");
  } else if (action === "uncomment") {
    if (!isUuid(b.comment_id)) return json(req, { error: "bad_request" }, 400);
    const { data: c } = await admin.from("moaboard_comments").select("id, student_id, by_teacher, moaboard_posts!inner(board_id)")
      .eq("id", b.comment_id).eq("moaboard_posts.board_id", board.id).maybeSingle();
    if (!c || c.by_teacher || c.student_id !== me) return fail(404, "not_found", "지울 수 있는 댓글이 아니에요.");
    await admin.from("moaboard_comments").delete().eq("id", c.id);
  } else if (action === "react") {
    const kind = String(b.kind ?? "");
    if (!(REACTIONS as readonly string[]).includes(kind)) return json(req, { error: "bad_request" }, 400);
    if (kind === "like" ? !board.allow_like : !board.allow_emoji) return fail(403, "no_react", "이 보드에서는 쓸 수 없어요.");
    const p = await visiblePost(b.post_id);
    if (!p) return fail(404, "not_found", "글을 찾지 못했어요.");
    const { data: had } = await admin.from("moaboard_reactions").delete().eq("post_id", p.id).eq("actor_id", me).eq("kind", kind).select("kind");
    if (!had?.length) await admin.from("moaboard_reactions").insert({ post_id: p.id, actor_id: me, kind });
  }

  // 보드 읽기(쓰기 action 뒤에도 바뀐 보드를 돌려준다)
  const [{ data: sections }, { data: rows }] = await Promise.all([
    admin.from("moaboard_sections").select("id, title, position").eq("board_id", board.id),
    admin.from("moaboard_posts").select(POST_COLS).eq("board_id", board.id).or(`status.eq.visible,student_id.eq.${me}`).order("created_at").limit(500),
  ]);
  const posts = (rows ?? []) as unknown as PostRow[];
  const paths = [...new Set([board.bg_image_path as string | null, ...posts.flatMap((p) => [p.image_path, p.file_path, p.video_path ?? null])].filter((p): p is string => !!p))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await admin.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
  }
  return json(req, { ok: true, ...shapeBoard(board as unknown as Board, sections ?? [], posts, me, urls) });
});
