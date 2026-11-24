// 모아보드 학생 함수의 순수 로직(시험 가능: DB·네트워크를 쓰지 않음).
// 실행: node --experimental-strip-types --test supabase/functions/moaboard-student/logic.test.ts
//   (포털의 supabase/functions/_shared 가 있어야 해요. 배포할 때는 GitHub Actions 가 가져와요)
import { isOwnPath, type PolicyOverride } from "../_shared/files.ts";

export const APP_ENTRY_ID = "00000000-0000-4000-8000-00000000a99a";
export const APP = "moaboard";
/** 전환 기간에만: 예전 파일(첫 칸이 moaboard 가 아닌 경로)이 있는 버킷. 예전 파일을 모두 옮기면 지운다 */
export const LEGACY_BUCKET = "moaboard-files";
export const LIMITS = { title: 60, body: 1000, comment: 200, fileName: 200, imageBytes: 10 * 1024 * 1024, fileBytes: 20 * 1024 * 1024, videoBytes: 50 * 1024 * 1024,
  postsPerStudent: 30, commentsPerStudent: 100 };
export const REACTIONS = ["like", "👍", "😊", "😮", "👏", "🤔"] as const;
export const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];
export const VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];
export const FILE_EXT = ["pdf", "hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip"];

/** 모아보드가 받는 종류·크기(쌤허브 공통 파일 모듈 issueUpload 의 policy) */
export const POLICY: PolicyOverride = { image: { max: 10 * 1024 * 1024 }, video: { max: 50 * 1024 * 1024 }, file: { max: 20 * 1024 * 1024 } };
/** 새 경로(공통 파일 모듈)인지: 첫 칸이 moaboard. 예전 경로와 가르는 판단은 이 함수 하나로만 한다 */
export const isHubPath = (p: unknown): p is string => typeof p === "string" && p.startsWith(`${APP}/`);
/** 화면이 보기 주소를 다시 쓰려고 쓰는 짧은 이름(경로 마지막 칸의 무작위 id). 경로 전체는 학생에게 보내지 않는다 */
export const fileKey = (p: string | null | undefined) => p ? (p.split("/").pop() || "").split(".")[0] || null : null;

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const clean = (v: unknown) => String(v ?? "").normalize("NFC").replace(/\r\n?/g, "\n").trim();
export const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

type Err = { error: string; message: string };
const bad = (error: string, message: string): Err => ({ error, message });

/** 글 내용 검사. 통과하면 정리된 값, 아니면 오류 */
export function checkPost(b: Record<string, unknown>, own: { teacherId: string; boardId: string; studentId: string }, allowFiles: boolean):
  { ok: true; v: { title: string; body: string; image_path: string | null; file_path: string | null; file_name: string | null; file_size: number | null;
    video_path: string | null; video_name: string | null; video_size: number | null; section_id: string | null } } | Err {
  const title = clean(b.title), body = clean(b.body);
  if (title.length > LIMITS.title) return bad("bad_title", `제목은 ${LIMITS.title}자까지 쓸 수 있어요.`);
  if (body.length > LIMITS.body) return bad("bad_body", `내용은 ${LIMITS.body}자까지 쓸 수 있어요.`);
  const image_path = b.image_path == null || b.image_path === "" ? null : String(b.image_path);
  const file = b.file && typeof b.file === "object" ? b.file as Record<string, unknown> : null;
  const file_path = file?.path ? String(file.path) : null;
  const video = b.video && typeof b.video === "object" ? b.video as Record<string, unknown> : null;
  const video_path = video?.path ? String(video.path) : null;
  if ((image_path || file_path || video_path) && !allowFiles) return bad("no_files", "이 보드에는 사진·파일을 올릴 수 없어요.");
  if (video_path && !ownFile(video_path, own, VIDEO_EXT)) return bad("bad_file", "영상을 다시 골라 주세요.");
  const video_name = video_path ? (clean(video?.name).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, LIMITS.fileName) || "영상") : null;
  const vn = Number(video?.size);
  const video_size = video_path && Number.isFinite(vn) && vn >= 0 && vn <= LIMITS.videoBytes ? Math.round(vn) : null;
  if (image_path && !ownFile(image_path, own, IMAGE_EXT)) return bad("bad_file", "사진을 다시 골라 주세요.");
  let file_name: string | null = null, file_size: number | null = null;
  if (file_path) {
    if (!ownFile(file_path, own, FILE_EXT)) return bad("bad_file", "파일을 다시 골라 주세요.");
    file_name = clean(file?.name).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, LIMITS.fileName) || "파일";
    const n = Number(file?.size);
    file_size = Number.isFinite(n) && n >= 0 && n <= LIMITS.fileBytes ? Math.round(n) : null;
  }
  if (!title && !body && !image_path && !file_path && !video_path) return bad("empty", "제목이나 내용을 적어 주세요.");
  const section_id = isUuid(b.section_id) ? b.section_id : null;
  return { ok: true, v: { title, body, image_path, file_path, file_name, file_size, video_path, video_name, video_size, section_id } };
}

/** 학생이 붙인 파일이 이 학생·이 보드 것이고 종류에 맞는지. 새 경로는 공통 모듈 isOwnPath, 예전 경로는 ownPath */
export function ownFile(path: string, own: { teacherId: string; boardId: string; studentId: string }, exts: string[]): boolean {
  if (isHubPath(path)) {
    return isOwnPath(path, { appSlug: APP, teacherId: own.teacherId, contentId: own.boardId, studentId: own.studentId })
      && exts.includes(extOf(path));
  }
  return ownPath(path, own, exts);
}

/** 예전 경로: <교사>/<보드>/<학생>/<무작위>.<확장자> 만 받아요(다른 사람 파일을 붙일 수 없게). 전환 기간에만 */
export function ownPath(path: string, own: { teacherId: string; boardId: string; studentId: string }, exts: string[]): boolean {
  const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.([a-z0-9]{1,5})$/.exec(path);
  return !!m && m[1] === own.teacherId && m[2] === own.boardId && m[3] === own.studentId && exts.includes(m[4]);
}

export type Board = { id: string; title: string; description: string; layout: string; needs_approval: boolean; allow_post: boolean;
  allow_comments: boolean; allow_like: boolean; allow_emoji: boolean; allow_files: boolean; show_names: boolean; updated_at: string;
  bg_preset?: string | null; bg_image_path?: string | null; card_color?: string | null; comments_inline?: boolean };
export type PostRow = { id: string; board_id: string; section_id: string | null; position: number; student_id: string | null; by_teacher: boolean;
  author_name: string; title: string; body: string; image_path: string | null; file_path: string | null; file_name: string | null; file_size: number | null;
  video_path?: string | null; video_name?: string | null; video_size?: number | null;
  status: string; created_at: string; moaboard_comments?: CommentRow[]; moaboard_reactions?: { actor_id: string; kind: string }[] };
export type CommentRow = { id: string; student_id: string | null; by_teacher: boolean; author_name: string; body: string; created_at: string };

/**
 * 학생에게 보낼 보드. 확인 전 글은 쓴 학생에게만, 친구 이름 숨기기면 이름을 빼고 보내요.
 * urls: 파일 경로 → 잠깐 쓰는 주소
 */
export function shapeBoard(board: Board, sections: { id: string; title: string; position: number }[], rows: PostRow[], me: string, urls: Map<string, string>) {
  const name = (r: { by_teacher: boolean; student_id: string | null; author_name: string }) =>
    r.by_teacher ? "선생님" : r.student_id === me ? r.author_name : board.show_names ? r.author_name : "";
  const posts = rows.filter((p) => p.status === "visible" || p.student_id === me).map((p) => {
    const rx = (p.moaboard_reactions ?? []).filter((r) => r.kind === "like" ? board.allow_like : board.allow_emoji);
    const emojis: Record<string, number> = {};
    for (const r of rx) if (r.kind !== "like") emojis[r.kind] = (emojis[r.kind] || 0) + 1;
    return {
      id: p.id, board_id: p.board_id, section_id: p.section_id, position: p.position, title: p.title, body: p.body,
      author: name(p), by_teacher: p.by_teacher, mine: !p.by_teacher && p.student_id === me, status: p.status,
      image: p.image_path ? urls.get(p.image_path) ?? null : null, image_key: fileKey(p.image_path), image_path: p.student_id === me ? p.image_path : null,
      file: p.file_path ? { name: p.file_name, size: p.file_size ?? 0, url: urls.get(p.file_path) ?? null, key: fileKey(p.file_path), path: p.student_id === me ? p.file_path : null } : null,
      video: p.video_path ? { name: p.video_name ?? "영상", size: p.video_size ?? 0, url: urls.get(p.video_path) ?? null, key: fileKey(p.video_path), path: p.student_id === me ? p.video_path : null } : null,
      created_at: p.created_at,
      likes: rx.filter((r) => r.kind === "like").length, liked: rx.some((r) => r.kind === "like" && r.actor_id === me),
      emojis, my_emojis: rx.filter((r) => r.kind !== "like" && r.actor_id === me).map((r) => r.kind),
      comments: board.allow_comments ? (p.moaboard_comments ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((c) => ({ id: c.id, author: name(c), body: c.body, by_teacher: c.by_teacher, mine: !c.by_teacher && c.student_id === me, created_at: c.created_at })) : [],
    };
  });
  return {
    board: { id: board.id, title: board.title, description: board.description, layout: board.layout, needs_approval: board.needs_approval,
      allow_post: board.allow_post, allow_comments: board.allow_comments, allow_like: board.allow_like, allow_emoji: board.allow_emoji,
      allow_files: board.allow_files, show_names: board.show_names, updated_at: board.updated_at,
      comments_inline: board.comments_inline !== false, bg_preset: board.bg_preset ?? null, card_color: board.card_color ?? null, bg_image: board.bg_image_path ? urls.get(board.bg_image_path) ?? null : null, bg_image_key: fileKey(board.bg_image_path) },
    sections: board.layout === "wall" ? [] : sections.slice().sort((a, b) => a.position - b.position),
    posts,
  };
}
