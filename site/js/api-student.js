// 학생용 저장소: 학생은 DB 를 직접 쓰지 못하고 서버 함수 moaboard-student 만 부른다.
// 화면(board.js)이 부르는 함수 이름은 교사용(api-teacher.js)과 같다. 교사만 쓰는 것(칸·확인·옮기기)은 없다.
import { studentCall } from "/shared/student.js";
import { uploadWith } from "/shared/files.js";

const FN = "moaboard-student";
const POLL_MS = 5000;   // 학생 화면은 5초마다 다시 읽어요(화면이 보일 때만)

/** 서버가 준 문구를 화면에 그대로 보여 주려고 오류에 담아요 */
function fail(r) {
  const e = new Error(r.data?.message || "잠시 후 다시 해 주세요.");
  e.userMessage = r.data?.message || (r.status === 0 ? "인터넷 연결을 확인해 주세요." : "");
  return e;
}

/**
 * @param o.me         initStudent 가 돌려준 학생(token, logout)
 * @param o.contentId  주소의 c (보드 id 또는 APP_ENTRY_ID)
 * @param o.boardId    APP_ENTRY_ID 로 들어왔을 때 학생이 고른 보드
 */
export function createStudentApi({ me, contentId, boardId = null }) {
  let last = null, lastAt = 0;
  const subs = new Set();
  const notify = () => subs.forEach((fn) => fn());

  async function call(action, body = {}) {
    const r = await studentCall(FN, { session_token: me.token, content_id: contentId, board_id: boardId ?? undefined, action, ...body });
    if (r.status === 401) { await me.logout({ reason: "expired" }); throw fail(r); }
    if (!r.data?.ok) throw fail(r);
    return r.data;
  }
  const urlKeep = new Map();   // 파일 key → { url, at }
  const KEEP_MS = 50 * 60 * 1000;
  /** 같은 파일은 50분 동안 처음 받은 주소를 그대로(5초마다 다시 읽어도 사진을 새로 받지 않게). 1시간이 되기 전에 새 주소로 */
  function keepUrls(d) {
    const now = Date.now();
    const pick = (key, url) => {
      if (!key || !url) return url;
      const c = urlKeep.get(key);
      if (c && now - c.at < KEEP_MS) return c.url;
      urlKeep.set(key, { url, at: now }); return url;
    };
    d.board.bg_image = pick(d.board.bg_image_key, d.board.bg_image);
    for (const p of d.posts) {
      p.image = pick(p.image_key, p.image);
      if (p.file) p.file.url = pick(p.file.key, p.file.url);
      if (p.video) p.video.url = pick(p.video.key, p.video.url);
    }
    return d;
  }
  async function write(action, body) {
    const d = keepUrls(await call(action, body));
    last = { board: d.board, sections: d.sections, posts: d.posts }; lastAt = Date.now();
    notify();
  }

  return {
    /** APP_ENTRY_ID 로 들어왔을 때 보드 고르기 목록 */
    async listBoards() { return (await call("boards")).boards; },
    async getBoard(id) {
      if (id) boardId = contentId === id ? null : id;
      if (last && Date.now() - lastAt < 1500) return structuredClone(last);   // 방금 쓴 결과가 있으면 다시 부르지 않아요
      const d = keepUrls(await call("board"));
      last = { board: d.board, sections: d.sections, posts: d.posts }; lastAt = Date.now();
      return structuredClone(last);
    },
    createPost: (_boardId, v) => write("post", payload(v)),
    updatePost: (id, v) => write("edit", { post_id: id, ...payload(v) }),
    deletePost: (id) => write("delete", { post_id: id }),
    toggleLike: (id) => write("react", { post_id: id, kind: "like" }),
    toggleEmoji: (id, kind) => write("react", { post_id: id, kind }),
    addComment: (id, body) => write("comment", { post_id: id, body }),
    deleteComment: (_postId, commentId) => write("uncomment", { comment_id: commentId }),

    /** 서버가 만든 내 폴더 주소로 바로 올려요(10분 유효). 미리보기는 이 기기의 파일로 */
    /** 서버(공통 파일 모듈)가 준 내 폴더 주소로 올려요. 사진은 올리기 전에 줄여요(공통 모듈). 미리보기는 이 기기의 파일로 */
    async uploadFile(file, kind, shrink) {
      const up = await uploadWith((meta) => call("upload_url", meta), file, kind, undefined, shrink);
      return { name: up.name, size: up.size, path: up.path, url: up.previewUrl };
    },

    subscribe(fn) {
      subs.add(fn);
      const t = setInterval(() => { if (!document.hidden) fn(); }, POLL_MS);
      return () => { subs.delete(fn); clearInterval(t); };
    },
  };
}

const payload = (v) => ({ title: v.title, body: v.body, section_id: v.section_id ?? null, image_path: v.image_path ?? null,
  file: v.file?.path ? { path: v.file.path, name: v.file.name, size: v.file.size } : null,
  video: v.video?.path ? { path: v.video.path, name: v.video.name, size: v.video.size } : null });
