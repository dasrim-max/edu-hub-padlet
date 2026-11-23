// 시안 확인용 저장소: 서버 없이 이 브라우저 메모리에서만 돌아가요(새로고침하면 처음으로).
// 개발 시: 같은 함수 이름으로 교사용(api-teacher.js, Supabase + RLS)과 학생용(api-student.js, 서버 함수 moaboard-student)을 만들어 바꿔 끼워요.
// 화면 코드는 이 파일의 함수만 부르므로 화면은 그대로 둡니다.

const now = Date.now();
const ago = (min) => new Date(now - min * 60e3).toISOString();
let seq = 100;
const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

// ---- 예시 데이터 ----
const STUDENTS = ["김민준A", "이서연", "박지호", "최하윤", "정우진", "한도윤", "윤지아", "강시우"];
const boards = [
  { id: "00000000-0000-4000-8000-000000000001", title: "우리 반 환경 캠페인", description: "캠페인 아이디어를 하나씩 붙여 주세요.", layout: "column", bg_preset: "cream-dots", card_color: null,
    needs_approval: true, allow_post: true, allow_comments: true, allow_like: true, allow_emoji: true, allow_files: true, show_names: true, updated_at: ago(3) },
  { id: "00000000-0000-4000-8000-000000000002", title: "오늘 배운 것 한 줄", description: "", layout: "wall", bg_preset: null, card_color: "yellow",
    needs_approval: false, allow_post: true, allow_comments: true, allow_like: true, allow_emoji: false, allow_files: false, show_names: false, updated_at: ago(60 * 26) },
  { id: "00000000-0000-4000-8000-000000000003", title: "과학 실험 보고서 모음", description: "모둠별로 사진과 보고서 파일을 올려요.", layout: "grid", bg_preset: "navy-grid", card_color: null,
    needs_approval: false, allow_post: true, allow_comments: false, allow_like: true, allow_emoji: true, allow_files: true, show_names: true, updated_at: ago(60 * 24 * 6) },
];
const sections = [
  { id: "s1", board_id: boards[0].id, title: "학교에서", position: 0 },
  { id: "s2", board_id: boards[0].id, title: "집에서", position: 1 },
  { id: "s3", board_id: boards[0].id, title: "마을에서", position: 2 },
  { id: "s4", board_id: boards[2].id, title: "1모둠", position: 0 },
  { id: "s5", board_id: boards[2].id, title: "2모둠", position: 1 },
];
const post = (board, section, i, title, body, extra = {}) => ({
  id: uid(), board_id: board.id, section_id: section, position: i, title, body,
  author: extra.teacher ? "선생님" : STUDENTS[i % STUDENTS.length], by_teacher: !!extra.teacher, mine: !!extra.mine,
  status: extra.pending ? "pending" : "visible", image: extra.image || null, file: extra.file || null,
  created_at: ago(extra.min ?? 40 - i * 4), likes: extra.likes ?? (i * 3) % 7, liked: !!extra.liked,
  emojis: extra.emojis || {}, my_emojis: extra.my_emojis || [], comments: extra.comments || [],
});
const posts = [
  post(boards[0], "s1", 0, "분리수거 포스터 만들기", "복도마다 분리수거 방법을 그린 포스터를 붙이면 좋겠어요.", { image: "demo/poster.svg", emojis: { "👍": 4, "👏": 2 }, comments: [
    { id: uid(), author: "이서연", body: "저도 그리고 싶어요!", created_at: ago(20), mine: false },
    { id: uid(), author: "선생님", body: "좋은 생각이에요. 미술 시간에 해 봐요.", created_at: ago(12), by_teacher: true } ] }),
  post(boards[0], "s1", 1, "교실 식물 키우기", "창가에 화분을 두고 당번을 정해서 물을 줘요.", { image: "demo/plant.svg", liked: true, emojis: { "😊": 3 } }),
  post(boards[0], "s1", 2, "점심시간 독서 캠페인", "", { pending: true, min: 2 }),
  post(boards[0], "s2", 3, "안 쓰는 전기 끄기", "방에서 나올 때 불 끄기, 플러그 뽑기를 가족과 약속해요.", { mine: true, emojis: { "👍": 1 }, my_emojis: ["👍"] }),
  post(boards[0], "s2", 4, "장바구니 쓰기", "비닐봉지 대신 장바구니를 챙겨요.", { file: { name: "장바구니_약속표.hwp", size: 48210 } }),
  post(boards[0], "s3", 5, "쓰레기 줍기 산책", "토요일 아침에 공원 한 바퀴 돌면서 쓰레기를 주워요. 집게와 장갑을 준비해요.", { comments: [{ id: uid(), author: "정우진", body: "같이 가요", created_at: ago(5) }] }),
  post(boards[0], null, 6, "", "칸을 정하지 못한 생각: 급식 남기지 않기", { pending: true, min: 1 }),
  post(boards[1], null, 0, "", "식물은 햇빛과 물로 양분을 만든다.", {}),
  post(boards[1], null, 1, "분수의 덧셈", "분모를 같게 만든 뒤 분자끼리 더해요. 3/4 + 1/8 = 6/8 + 1/8 = 7/8", {}),
  post(boards[1], null, 2, "", "임진왜란 때 이순신 장군이 한산도에서 학익진으로 이겼다.", { likes: 5 }),
  post(boards[1], null, 3, "오늘 느낀 점", "친구 발표를 들으면서 질문을 두 개 했다. 다음에는 내가 먼저 발표해 보고 싶다.", {}),
  post(boards[1], null, 4, "", "곤충의 몸은 머리, 가슴, 배 세 부분이다.", {}),
  post(boards[2], "s4", 0, "자석 실험", "막대자석의 같은 극끼리는 밀어내요.", { image: "demo/chart.svg", file: { name: "1모둠_보고서.pdf", size: 1288000 } }),
  post(boards[2], "s5", 1, "용해 실험", "따뜻한 물에서 설탕이 더 빨리 녹았어요.", { file: { name: "2모둠_결과표.xlsx", size: 20480 } }),
];

// 시안에서는 화면을 옮겨도 바꾼 내용이 남도록 이 탭(sessionStorage)에 둬요. 주소에 reset=1 이면 처음 예시로
const KEY = "moaboard:demo";
try {
  if (new URLSearchParams(location.search).get("reset") === "1") sessionStorage.removeItem(KEY);
  const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
  if (saved) { boards.splice(0, boards.length, ...saved.boards); sections.splice(0, sections.length, ...saved.sections); posts.splice(0, posts.length, ...saved.posts); seq = saved.seq; }
} catch { /* 저장 불가 환경이면 메모리만 */ }
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ boards, sections, posts, seq })); } catch { /* 무시 */ } };

// ---- 시안 상태(목록 화면의 불러오는 중·빈 상태·오류를 볼 때) ----
const q = new URLSearchParams(location.search);
const DEMO_STATE = q.get("state") || "ok";           // ok | loading | empty | error
const wait = (ms = 250) => new Promise((ok) => setTimeout(ok, ms));
async function gate() {
  if (DEMO_STATE === "loading") return new Promise(() => {});  // 영원히 불러오는 중
  await wait();
  if (DEMO_STATE === "error") throw new Error("demo error");
}

// ---- 실시간 반영 흉내: 바뀌면 구독한 화면을 다시 그려요 (개발 시: Supabase Realtime 또는 학생은 5초 간격 다시 읽기) ----
const subs = new Set();
const emit = () => { save(); subs.forEach((fn) => fn()); };
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

const touch = (boardId) => { const b = boards.find((x) => x.id === boardId); if (b) b.updated_at = new Date().toISOString(); };
const clone = (v) => structuredClone(v);

// ---- 보드 ----
export async function listBoards() {
  await gate();
  if (DEMO_STATE === "empty") return [];
  return clone(boards).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((b) => ({
    ...b,
    post_count: posts.filter((p) => p.board_id === b.id && p.status === "visible").length,
    pending_count: posts.filter((p) => p.board_id === b.id && p.status === "pending").length,
  }));
}
export async function getBoard(id) {
  await gate();
  const b = boards.find((x) => x.id === id);
  if (!b) return null;
  return {
    board: clone(b),
    sections: clone(sections.filter((s) => s.board_id === id)).sort((a, z) => a.position - z.position),
    posts: clone(posts.filter((p) => p.board_id === id)),
  };
}
export async function createBoard(v) {
  await wait();
  const b = { id: uid(), description: "", ...v, updated_at: new Date().toISOString() };
  boards.push(b);
  if (b.layout !== "wall") sections.push({ id: uid(), board_id: b.id, title: "첫 번째 칸", position: 0 });
  save(); return clone(b);
}
export async function updateBoard(id, patch) {
  await wait(150);
  const b = boards.find((x) => x.id === id);
  Object.assign(b, patch); touch(id);
  b.bg_image = patch.bg_image_path ?? null;   // 시안: 올린 사진 주소를 그대로 경로로 써요
  if (b.layout !== "wall" && !sections.some((s) => s.board_id === id)) sections.push({ id: uid(), board_id: id, title: "첫 번째 칸", position: 0 });
  emit(); return clone(b);
}
export async function deleteBoard(id) {
  await wait(150);
  boards.splice(boards.findIndex((x) => x.id === id), 1);
  for (let i = posts.length - 1; i >= 0; i--) if (posts[i].board_id === id) posts.splice(i, 1);
  save();
}

// ---- 칸 ----
export async function addSection(boardId, title) {
  await wait(100);
  const pos = Math.max(-1, ...sections.filter((s) => s.board_id === boardId).map((s) => s.position)) + 1;
  sections.push({ id: uid(), board_id: boardId, title, position: pos }); touch(boardId); emit();
}
export async function renameSection(id, title) { await wait(100); sections.find((s) => s.id === id).title = title; emit(); }
/** 칸을 지우면 그 칸의 글은 "칸 없음"으로 옮겨요(글은 지우지 않아요) */
export async function deleteSection(id) {
  await wait(100);
  posts.forEach((p) => { if (p.section_id === id) p.section_id = null; });
  sections.splice(sections.findIndex((s) => s.id === id), 1); emit();
}
export async function moveSection(id, dir) {
  await wait(50);
  const s = sections.find((x) => x.id === id);
  const list = sections.filter((x) => x.board_id === s.board_id).sort((a, b) => a.position - b.position);
  const i = list.indexOf(s), j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i].position, list[j].position] = [list[j].position, list[i].position]; emit();
}

// ---- 글 ----
export async function createPost(boardId, v, { asTeacher, needsApproval, author }) {
  await wait(200);
  const sec = v.section_id ?? null;
  const pos = Math.max(-1, ...posts.filter((p) => p.board_id === boardId && p.section_id === sec).map((p) => p.position)) + 1;
  posts.push({ id: uid(), board_id: boardId, section_id: sec, position: pos, title: v.title, body: v.body,
    author: asTeacher ? "선생님" : author, by_teacher: !!asTeacher, mine: true,
    status: !asTeacher && needsApproval ? "pending" : "visible", image: v.image || null, file: v.file || null, video: v.video || null,
    created_at: new Date().toISOString(), likes: 0, liked: false, emojis: {}, my_emojis: [], comments: [] });
  touch(boardId); emit();
}
export async function updatePost(id, patch) { await wait(150); Object.assign(posts.find((p) => p.id === id), patch); emit(); }
export async function deletePost(id) { await wait(100); posts.splice(posts.findIndex((p) => p.id === id), 1); emit(); }
export async function approvePost(id) { await wait(100); posts.find((p) => p.id === id).status = "visible"; emit(); }
/** 글을 다른 칸(또는 같은 칸의 다른 자리)으로 옮겨요. beforeId 가 없으면 맨 뒤 */
export async function movePost(id, sectionId, beforeId) {
  const p = posts.find((x) => x.id === id);
  const list = posts.filter((x) => x.board_id === p.board_id && x.section_id === sectionId && x.id !== id).sort((a, b) => a.position - b.position);
  const at = beforeId ? list.findIndex((x) => x.id === beforeId) : -1;
  list.splice(at < 0 ? list.length : at, 0, p);
  p.section_id = sectionId;
  list.forEach((x, i) => (x.position = i));
  emit();
  await wait(50);
}

// ---- 반응·댓글 ----
export async function toggleLike(id) {
  const p = posts.find((x) => x.id === id);
  p.liked = !p.liked; p.likes += p.liked ? 1 : -1; emit();
}
export async function toggleEmoji(id, e) {
  const p = posts.find((x) => x.id === id);
  const on = p.my_emojis.includes(e);
  p.my_emojis = on ? p.my_emojis.filter((x) => x !== e) : [...p.my_emojis, e];
  p.emojis[e] = Math.max(0, (p.emojis[e] || 0) + (on ? -1 : 1));
  if (!p.emojis[e]) delete p.emojis[e];
  emit();
}
export async function addComment(id, body, { asTeacher, author }) {
  await wait(150);
  posts.find((x) => x.id === id).comments.push({ id: uid(), author: asTeacher ? "선생님" : author, body, by_teacher: !!asTeacher, mine: true, created_at: new Date().toISOString() });
  emit();
}
export async function deleteComment(postId, commentId) {
  await wait(100);
  const p = posts.find((x) => x.id === postId);
  p.comments = p.comments.filter((c) => c.id !== commentId); emit();
}

// ---- 파일 올리기 (개발 시: 비공개 저장소 moaboard-files 에 올리고, 보여 줄 때는 잠깐 쓰는 주소를 받아요) ----
export async function uploadFile(file) {
  await wait(400);
  const url = URL.createObjectURL(file);
  return { name: file.name, size: file.size, url, path: url };
}

// ---- 학생 초대 (개발 시: hub.openInvite({ appSlug, contentId, title }) 를 그대로 불러요) ----
export function demoInvite(title) {
  const SSUI = window.SSUI;
  const scrim = document.getElementById("mb-invite");
  scrim.querySelector("h2").textContent = title;
  SSUI?.fakeQR(scrim.querySelector("svg"), title);
  SSUI?.openModal(scrim);
}
