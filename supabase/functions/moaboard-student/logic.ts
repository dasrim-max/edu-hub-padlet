// 모아보드 학생 함수의 순수 로직(시험 가능: DB·네트워크를 쓰지 않음).
// 실행: node --experimental-strip-types --test supabase/functions/moaboard-student/logic.test.ts

export const APP_ENTRY_ID = "00000000-0000-4000-8000-00000000a99a";
export const BUCKET = "moaboard-files";
export const LIMITS = { title: 60, body: 1000, comment: 200, fileName: 200, imageBytes: 10 * 1024 * 1024, fileBytes: 20 * 1024 * 1024,
  postsPerStudent: 30, commentsPerStudent: 100 };
export const REACTIONS = ["like", "👍", "😊", "😮", "👏", "🤔"] as const;
export const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];
export const FILE_EXT = ["pdf", "hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip"];

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const clean = (v: unknown) => String(v ?? "").normalize("NFC").replace(/\r\n?/g, "\n").trim();
export const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();

type Err = { error: string; message: string };
const bad = (error: string, message: string): Err => ({ error, message });

/** 글 내용 검사. 통과하면 정리된 값, 아니면 오류 */
export function checkPost(b: Record<string, unknown>, own: { teacherId: string; boardId: string; studentId: string }, allowFiles: boolean):
  { ok: true; v: { title: string; body: string; image_path: string | null; file_path: string | null; file_name: string | null; file_size: number | null; section_id: string | null } } | Err {
  const title = clean(b.title), body = clean(b.body);
  if (title.length > LIMITS.title) return bad("bad_title", `제목은 ${LIMITS.title}자까지 쓸 수 있어요.`);
  if (body.length > LIMITS.body) return bad("bad_body", `내용은 ${LIMITS.body}자까지 쓸 수 있어요.`);
  const image_path = b.image_path == null || b.image_path === "" ? null : String(b.image_path);
  const file = b.file && typeof b.file === "object" ? b.file as Record<string, unknown> : null;
  const file_path = file?.path ? String(file.path) : null;
  if ((image_path || file_path) && !allowFiles) return bad("no_files", "이 보드에는 사진·파일을 올릴 수 없어요.");
  if (image_path && !ownPath(image_path, own, IMAGE_EXT)) return bad("bad_file", "사진을 다시 골라 주세요.");
  let file_name: string | null = null, file_size: number | null = null;
  if (file_path) {
    if (!ownPath(file_path, own, FILE_EXT)) return bad("bad_file", "파일을 다시 골라 주세요.");
    file_name = clean(file?.name).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, LIMITS.fileName) || "파일";
    const n = Number(file?.size);
    file_size = Number.isFinite(n) && n >= 0 && n <= LIMITS.fileBytes ? Math.round(n) : null;
  }
  if (!title && !body && !image_path && !file_path) return bad("empty", "제목이나 내용을 적어 주세요.");
  const section_id = isUuid(b.section_id) ? b.section_id : null;
  return { ok: true, v: { title, body, image_path, file_path, file_name, file_size, section_id } };
}

/** 학생이 올린 파일은 <교사>/<보드>/<학생>/<무작위>.<확장자> 경로만 받아요(다른 사람 파일을 붙일 수 없게) */
export function ownPath(path: string, own: { teacherId: string; boardId: string; studentId: string }, exts: string[]): boolean {
  const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.([a-z0-9]{1,5})$/.exec(path);
  return !!m && m[1] === own.teacherId && m[2] === own.boardId && m[3] === own.studentId && exts.includes(m[4]);
}

/** 올릴 파일 검사 → 저장 경로 */
export function uploadPath(b: Record<string, unknown>, own: { teacherId: string; boardId: string; studentId: string }, id: string): { ok: true; path: string } | Err {
  const kind = b.kind === "image" ? "image" : "file";
  const ext = extOf(clean(b.name));
  const size = Number(b.size);
  if (kind === "image" && !IMAGE_EXT.includes(ext)) return bad("bad_type", "사진은 PNG, JPG, GIF, WEBP 파일만 올릴 수 있어요.");
  if (kind === "file" && !FILE_EXT.includes(ext)) return bad("bad_type", `이 파일은 올릴 수 없어요. ${FILE_EXT.join(", ")} 파일만 돼요.`);
  const max = kind === "image" ? LIMITS.imageBytes : LIMITS.fileBytes;
  if (!Number.isFinite(size) || size <= 0) return bad("bad_size", "빈 파일은 올릴 수 없어요.");
  if (size > max) return bad("too_big", kind === "image" ? "사진이 10MB보다 커요. 크기를 줄여서 다시 골라 주세요." : "파일이 20MB보다 커요. 나눠서 올리거나 크기를 줄여 주세요.");
  return { ok: true, path: `${own.teacherId}/${own.boardId}/${own.studentId}/${id}.${ext === "jpeg" ? "jpg" : ext}` };
}

export type Board = { id: string; title: string; description: string; layout: string; needs_approval: boolean; allow_post: boolean;
  allow_comments: boolean; allow_like: boolean; allow_emoji: boolean; allow_files: boolean; show_names: boolean; updated_at: string;
  bg_preset?: string | null; bg_image_path?: string | null; card_color?: string | null };
export type PostRow = { id: string; board_id: string; section_id: string | null; position: number; student_id: string | null; by_teacher: boolean;
  author_name: string; title: string; body: string; image_path: string | null; file_path: string | null; file_name: string | null; file_size: number | null;
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
      image: p.image_path ? urls.get(p.image_path) ?? null : null, image_path: p.student_id === me ? p.image_path : null,
      file: p.file_path ? { name: p.file_name, size: p.file_size ?? 0, url: urls.get(p.file_path) ?? null, path: p.student_id === me ? p.file_path : null } : null,
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
      bg_preset: board.bg_preset ?? null, card_color: board.card_color ?? null, bg_image: board.bg_image_path ? urls.get(board.bg_image_path) ?? null : null },
    sections: board.layout === "wall" ? [] : sections.slice().sort((a, b) => a.position - b.position),
    posts,
  };
}
