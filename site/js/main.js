// 모아보드 입구. 주소로 화면을 고릅니다.
//   /moaboard/                         교사: 내 보드 목록   (?mode=new 이면 바로 새 보드 만들기)
//   /moaboard/?c=<보드 id>              교사: 보드
//   /moaboard/?as=student&c=<보드 id>   학생: 보드
//   /moaboard/?as=student&c=APP_ENTRY_ID  학생(수업 흐름 "앱 전체"): 보드 고르기 → 보드
// 교사 로그인·교사 인증·자동 로그아웃·수업 흐름 위젯은 initHub, 학생 세션·자동 로그아웃은 initStudent 가 맡아요.
import { initHub, initStudent } from "/shared/index.js";
import { APP_ENTRY_ID } from "/shared/config.js";
import { isUuid } from "/shared/util.js";
import { h, SLUG, APP_NAME, errorBox, VERSION } from "./common.js";
import { createTeacherApi } from "./api-teacher.js";
import { createStudentApi } from "./api-student.js";
import { mountList } from "./list.js";
import { mountBoard } from "./board.js";

const q = new URLSearchParams(location.search);
const c = q.get("c");
const root = document.getElementById("app");
const setTitle = (t) => (document.title = `${t} · ${APP_NAME}`);

if (q.get("as") === "student") {
  document.body.classList.add("mb-body--stu");
  document.getElementById("bar").remove();        // 학생 화면에는 쌤허브 메뉴를 넣지 않아요
  const me = await initStudent({ appSlug: SLUG, contentId: c });
  if (c === APP_ENTRY_ID) await pickBoard(me);
  else await mountBoard({ root, api: createStudentApi({ me, contentId: c }), role: "student", me, boardId: c, onTitle: setTitle });
} else {
  // 쌤허브가 띄운 앱 창: 왼쪽 위에 앱 이름표(모아보드 + 버전)가 떠요. 앱은 그 자리(--ss-appbadge-w × --ss-appbadge-h)를 비워 둬요
  const hub = await initHub({ appName: APP_NAME, appVersion: VERSION, appSlug: SLUG, topbar: "#bar" });
  const api = createTeacherApi(hub);
  if (isUuid(c) && c !== APP_ENTRY_ID) {
    await mountBoard({ root, api, role: "teacher", boardId: c, bar: hub.topbar, onTitle: setTitle,
      onInvite: (b) => hub.openInvite({ appSlug: SLUG, contentId: b.id, title: b.title }),
      onDeleted: () => location.replace("./") });
  } else {
    await mountList({ root, api, bar: hub.topbar, openNew: q.get("mode") === "new", userName: hub.profile?.display_name || "",
      onOpen: (id) => { location.href = `?c=${encodeURIComponent(id)}`; } });
  }
}

/** 수업 흐름 "앱 전체"로 들어온 학생: 선생님 보드 중 하나를 골라 들어가요(한 화면에 하나) */
async function pickBoard(me) {
  const list = createStudentApi({ me, contentId: APP_ENTRY_ID });
  root.replaceChildren(h("div", { class: "mb-loading", "aria-busy": "true" }, h("div", { class: "ss-skeleton mb-sk mb-sk--title" }), h("div", { class: "ss-skeleton mb-sk mb-sk--card" })));
  let boards;
  try { boards = await list.listBoards(); }
  catch (e) { root.replaceChildren(errorBox(e?.userMessage || "보드를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.", () => location.reload())); return; }
  const open = (b) => mountBoard({ root, api: createStudentApi({ me, contentId: APP_ENTRY_ID, boardId: b.id }), role: "student", me, boardId: b.id, onTitle: setTitle });
  if (boards.length === 1) return open(boards[0]);
  root.replaceChildren(
    h("header", { class: "mb-head" }, h("div", { class: "mb-head__text" },
      h("h1", { class: "mb-title", text: "보드를 골라요" }), h("p", { class: "mb-meta", text: `${me.name || ""} 학생으로 들어왔어요` }))),
    boards.length
      ? h("div", { class: "mb-pick" }, boards.map((b) => h("button", { class: "mb-pick__btn", type: "button", text: b.title, onclick: () => open(b) })))
      : h("div", { class: "ss-empty mb-empty" }, h("b", { text: "아직 보드가 없어요" }), h("span", { text: "선생님이 보드를 만들면 여기에 보여요." })));
}
