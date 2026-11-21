// 학생용 저장소: 학생은 DB 를 직접 쓰지 못하고 서버 함수 moaboard-student 만 부른다.
// 화면(board.js)이 부르는 함수 이름은 교사용(api-teacher.js)과 같다. 교사만 쓰는 것(칸·확인·옮기기)은 없다.
import { studentCall } from "/shared/student.js";

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
  async function write(action, body) {
    const d = await call(action, body);
    last = { board: d.board, sections: d.sections, posts: d.posts }; lastAt = Date.now();
    notify();
  }

  return {
    /** APP_ENTRY_ID 로 들어왔을 때 보드 고르기 목록 */
    async listBoards() { return (await call("boards")).boards; },
    async getBoard(id) {
      if (id) boardId = contentId === id ? null : id;
      if (last && Date.now() - lastAt < 1500) return structuredClone(last);   // 방금 쓴 결과가 있으면 다시 부르지 않아요
      const d = await call("board");
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
    async uploadFile(file, kind) {
      const d = await call("upload_url", { kind: kind === "image" ? "image" : "file", name: file.name, size: file.size });
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      const res = await fetch(d.upload_url, { method: "PUT", body: form, headers: { "x-upsert": "false" }, signal: AbortSignal.timeout(120e3) }).catch(() => null);
      if (!res?.ok) throw fail({ status: 0, data: { message: "올리지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요." } });
      return { name: file.name, size: file.size, path: d.path, url: URL.createObjectURL(file) };
    },

    subscribe(fn) {
      subs.add(fn);
      const t = setInterval(() => { if (!document.hidden) fn(); }, POLL_MS);
      return () => { subs.delete(fn); clearInterval(t); };
    },
  };
}

const payload = (v) => ({ title: v.title, body: v.body, section_id: v.section_id ?? null, image_path: v.image_path ?? null,
  file: v.file?.path ? { path: v.file.path, name: v.file.name, size: v.file.size } : null });
