// 모아보드 입구(시안). 주소로 화면을 고릅니다.
//   ./                    교사: 내 보드 목록   (?mode=new 이면 바로 새 보드 만들기)
//   ./?c=<보드 id>         교사: 보드
//   ./?as=student&c=<id>  학생: 보드          (c=APP_ENTRY_ID 이면 앱 첫 화면 = 선생님이 가장 최근에 연 보드)
//
// 개발 시(데이터 연결):
//   교사: const hub = await initHub({ appName: APP_NAME, appSlug: SLUG, topbar: "#bar" });  bar = hub.topbar
//         보드를 만들거나 열면 hub.recordActivity({ appSlug: SLUG, contentId, title, url: `/moaboard/?c=${id}` })
//         보드를 지우면 hub.removeActivity({ appSlug: SLUG, contentId }) / 학생 초대 = hub.openInvite({ appSlug: SLUG, contentId, title })
//   학생: const me = await initStudent({ appSlug: SLUG, contentId: c })  (자동 로그아웃 경고도 여기서 켜져요)
//   api-demo.js 를 api-teacher.js / api-student.js 로 바꿔 끼워요.
import * as api from "./api-demo.js";
import { h, APP_NAME } from "./common.js";
import { mountList } from "./list.js";
import { mountBoard } from "./board.js";

const q = new URLSearchParams(location.search);
const root = document.getElementById("app");
const barHost = document.getElementById("bar");
const DEMO_FIRST_BOARD = "00000000-0000-4000-8000-000000000001";

/** 앱 자체 메뉴(쌤허브가 띄운 앱 창 모양: 앱 이름 + 앱 전용 버튼). 개발 시: hub.topbar 가 같은 일을 해요 */
function appBar() {
  const btns = h("span", { class: "mb-appbar__btns" });
  barHost.replaceChildren(h("header", { class: "ss-appbar" },
    h("span", { class: "ss-appbar__name", text: APP_NAME }), h("span", { class: "ss-appbar__sp" }), btns));
  return {
    addAction(label, fn) {
      const b = h("button", { class: "ss-appbtn" + (btns.children.length ? " ss-appbtn--sub" : ""), type: "button", text: label, onclick: fn });
      btns.append(b); return b;
    },
  };
}

if (q.get("as") === "student") {
  document.body.classList.add("mb-body--stu");
  barHost.remove();
  const me = { name: "이서연" };   // 개발 시: initStudent 가 돌려준 학생
  window.SSIdle?.start({ idleMs: 20 * 60e3, warnMs: 60e3, onLogout: () => location.replace("/join.html") });
  const c = q.get("c");
  await mountBoard({ root, api, role: "student", me, boardId: !c || c === "00000000-0000-4000-8000-00000000a99a" ? DEMO_FIRST_BOARD : c,
    onTitle: (t) => (document.title = `${t} · ${APP_NAME}`) });
} else {
  const bar = appBar();
  const c = q.get("c");
  if (c) {
    await mountBoard({ root, api, role: "teacher", boardId: c, bar,
      onInvite: (b) => api.demoInvite(b.title),
      onDeleted: () => location.replace("./"),
      onTitle: (t) => (document.title = `${t} · ${APP_NAME}`) });
  } else {
    await mountList({ root, api, bar, openNew: q.get("mode") === "new",
      onOpen: (id) => { location.href = `?c=${encodeURIComponent(id)}`; } });
  }
}
