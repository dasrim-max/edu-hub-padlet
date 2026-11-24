// 모아보드 새 화면 시안(A·B·C). 예시 데이터로만 그려요. 배포하지 않아요.
// <body data-variant="a|b|c" data-screen="list|board">
import { BG_PRESETS, CARD_COLORS } from "../../site/js/board-style.js";

const V = document.body.dataset.variant, SCREEN = document.body.dataset.screen;
const h = (tag, props = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v; else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const ICONS = {
  clock: "M9 2.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM9 5.5V9l2.5 1.5", pen: "M3 15l1-4 8-8 3 3-8 8zM10.5 4.5l3 3",
  star: "M9 2.5l2 4.2 4.5.6-3.3 3.1.8 4.5L9 12.7l-4 2.2.8-4.5L2.5 7.3 7 6.7z", trash: "M3.5 5h11M7 5V3.5h4V5M5 5l.8 10h6.4L13 5",
  folder: "M2.5 5.5v8.5h13V7h-7L7 5.5z", plus: "M9 4v10M4 9h10", search: "M8 3a5 5 0 1 0 0 10A5 5 0 0 0 8 3zM11.6 11.6 15 15",
  more: "M4.5 9h.01M9 9h.01M13.5 9h.01", gear: "M9 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 2v2M9 14v2M2 9h2M14 9h2M4 4l1.4 1.4M12.6 12.6 14 14M4 14l1.4-1.4M12.6 5.4 14 4",
  show: "M3 4h12v8H3zM7 15h4", share: "M6 9l6-4M6 9l6 4M5 7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM13 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM13 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  text: "M4 5h10M9 5v9", paint: "M3 13.5c2 0 2-2 4-2l6-6-2-2-6 6c0 2-2 2-2 4zM11 3.5l2 2", grid: "M3 3h5v5H3zM10 3h5v5h-5zM3 10h5v5H3zM10 10h5v5h-5z",
  users: "M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 15c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4M12 8.5a2 2 0 1 0 0-4M13 11c1.8.3 3 1.6 3 4", chat: "M3 4h12v7H7l-4 3z", tool: "M11 3a3 3 0 0 0-3.5 4L3 11.5 5.5 14 10 9.5A3 3 0 0 0 14 6l-2 1-1.5-1.5 1-2z",
};
const ico = (n) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 18 18"); s.setAttribute("class", "mk-ico"); s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", ICONS[n]); p.setAttribute("fill", "none"); p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", "1.6"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round"); s.append(p); return s; };

const BOARDS = [
  { title: "기상캐스터 일기예보 만들기", bg: "gradient-sunset", layout: "column", posts: 18, pending: 2, ago: "10시간 전", folder: "과학" },
  { title: "나의 그림자 작품 만들기", bg: "green-grid", layout: "wall", posts: 25, pending: 0, ago: "11시간 전", folder: "과학" },
  { title: "혼합물 장치 소개 4컷 만화", bg: "sky-dots", layout: "grid", posts: 12, pending: 0, ago: "15일 전", folder: "과학" },
  { title: "우리 반 환경 캠페인", bg: "cream-dots", layout: "column", posts: 7, pending: 1, ago: "3일 전", folder: "학급 운영" },
  { title: "오늘 배운 것 한 줄", bg: "notebook", layout: "wall", posts: 41, pending: 0, ago: "1주 전", folder: "국어", card: "yellow" },
  { title: "시 낭송 감상 나누기", bg: "stars", layout: "wall", posts: 9, pending: 0, ago: "2주 전", folder: "국어" },
];
const LAYOUT = { wall: "담벼락", column: "칸", grid: "묶음" };
const mini = (layout) => h("span", { class: `mk-mini mk-mini--${layout}`, "aria-hidden": "true" }, Array.from({ length: 6 }, () => h("i")));
const thumb = (b) => h("span", { class: "mk-card__thumb", "data-bg": b.bg, "data-card": b.card || null }, mini(b.layout),
  b.pending ? h("span", { class: "ss-badge ss-badge--expired mk-card__badge", text: `확인 기다림 ${b.pending}` }) : null);

function demoBar() {
  const here = location.pathname.split("/").pop();
  return h("nav", { class: "mk-demo" }, h("b", { text: "시안 확인용" }),
    ["a", "b", "c"].flatMap((v) => [["list", "목록"], ["board", "보드 설정"]].map(([s, label]) =>
      h("a", { href: `${v}-${s}.html`, "aria-current": here === `${v}-${s}.html` ? "page" : null, text: `시안 ${v.toUpperCase()} · ${label}` }))));
}

// ---------- 보드 목록 ----------
function side() {
  const navItem = (icon, label, n, cur) => h("a", { href: "#", "aria-current": cur ? "page" : null }, ico(icon), label, n != null ? h("small", { text: String(n) }) : null);
  return h("aside", { class: "mk-side", "aria-label": "모아보드 메뉴" },
    h("div", { class: "mk-side__hello" }, h("b", { text: "박동희 선생님" }), h("span", { text: "오늘은 어떤 생각을 모아 볼까요?" })),
    h("button", { class: "mk-new", type: "button" }, ico("plus"), "새 보드"),
    h("label", { class: "mk-search" }, ico("search"), h("input", { placeholder: "보드 찾기", "aria-label": "보드 찾기" })),
    h("nav", { class: "mk-nav" },
      navItem("clock", "최근", null, V !== "c"), navItem("pen", "내가 만든 보드", 6), navItem("star", "즐겨찾기", 2), navItem("trash", "휴지통", 1),
      V === "c" && h("p", { class: "mk-nav__label", text: "폴더" }),
      V === "c" && ["과학", "국어", "학급 운영"].map((f, i) => navItem("folder", f, BOARDS.filter((b) => b.folder === f).length, i === 0)),
      V === "c" && navItem("plus", "새 폴더")),
    h("div", { class: "mk-usage" }, h("b", { text: "파일 사용량" }), h("div", { class: "mk-bar" }, h("i")), h("span", { text: "0.44GB / 2GB" })));
}
function listScreen() {
  const sort = h("div", { class: "mk-sort", role: "group", "aria-label": "정렬" },
    h("button", { type: "button", "aria-pressed": "true", text: "최근 사용" }), h("button", { type: "button", "aria-pressed": "false", text: "이름" }));
  const list = V === "c" ? BOARDS.filter((b) => b.folder === "과학") : BOARDS;
  let body;
  if (V === "b") {
    body = h("div", { class: "mk-list" },
      h("div", { class: "mk-li mk-li--head" }, h("span"), h("span", { text: "보드" }), h("span", { text: "배치" }), h("span", { text: "글" }), h("span", { text: "마지막 사용" }), h("span")),
      list.map((b) => h("a", { class: "mk-li", href: "b-board.html" }, thumb(b),
        h("span", {}, h("span", { class: "mk-li__title", text: b.title }), b.pending ? h("span", { class: "mk-li__sub", text: ` · 확인 기다림 ${b.pending}` }) : null),
        h("span", { text: LAYOUT[b.layout] }), h("span", { text: `${b.posts}개` }), h("span", { class: "mk-li__sub", text: b.ago }),
        h("button", { class: "mk-more", type: "button", "aria-label": "보드 메뉴", onclick: (e) => e.preventDefault() }, ico("more")))));
  } else {
    body = h("div", { class: "mk-grid" },
      h("a", { class: "mk-card mk-card--new", href: "#" }, h("span", { class: "mk-card__thumb" }, "+"), h("span", { class: "mk-card__title", text: "새 보드 만들기" })),
      list.map((b) => h("a", { class: "mk-card", href: `${V}-board.html` }, thumb(b),
        h("span", { class: "mk-card__row" }, h("span", { class: "mk-card__title", text: b.title }),
          h("button", { class: "mk-more", type: "button", "aria-label": "보드 메뉴", onclick: (e) => e.preventDefault() }, ico("more"))),
        h("span", { class: "mk-card__meta", text: `${LAYOUT[b.layout]} · 글 ${b.posts}개 · ${b.ago}` }))));
  }
  return h("div", { class: "mk-shell" }, side(),
    h("main", { class: "mk-main" },
      h("div", { class: "mk-main__head" }, h("h1", { text: V === "c" ? "과학" : "최근" }), sort),
      V === "c" && h("div", { class: "mk-folders" }, ["과학", "국어", "학급 운영"].map((f, i) =>
        h("a", { class: "mk-folder", href: "#", "aria-current": i === 0 ? "page" : null }, ico("folder"), f, h("small", { text: String(BOARDS.filter((b) => b.folder === f).length) })))),
      body));
}

// ---------- 보드 설정 ----------
const TABS = [["basic", "기본", "text"], ["look", "꾸미기", "paint"], ["layout", "배치", "grid"], ["join", "학생 참여", "users"], ["react", "반응·댓글", "chat"], ["adv", "고급", "tool"]];
const row = (label, sub, on) => h("div", { class: "mk-rowi" }, h("span", {}, label, sub && h("small", { text: sub })), h("span", { class: "mk-switch" + (on ? " on" : ""), role: "switch", "aria-checked": String(!!on) }));
function panes(state) {
  const looks = h("div", { class: "mk-sws" });
  const drawSw = (group) => looks.replaceChildren(...BG_PRESETS.filter((p) => p.group === group).map((p) =>
    h("button", { class: "mk-sw" + (p.id === state.bg ? " is-on" : ""), type: "button", "data-bg": p.id, "aria-label": p.label, title: p.label,
      onclick: () => { state.bg = p.id; document.querySelectorAll("[data-live-bg]").forEach((el) => el.setAttribute("data-bg", p.id)); drawSw(group); } })));
  drawSw("pattern");
  const chips = h("div", { class: "mk-chips" }, [["pattern", "무늬"], ["gradient", "그라데이션"], ["photo", "사진"]].map(([g, l], i) =>
    h("button", { class: "mk-chip", type: "button", "aria-pressed": i === 0 ? "true" : "false", text: l, onclick: (e) => {
      chips.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      if (g === "photo") looks.replaceChildren(h("button", { class: "mk-chip", type: "button", text: "배경 사진 올리기" })); else drawSw(g);
    } })));
  return {
    basic: [h("div", { class: "mk-field" }, h("label", { text: "보드 이름" }), h("input", { class: "mk-input", value: "기상캐스터 일기예보 만들기" })),
      h("div", { class: "mk-field" }, h("label", { text: "안내" }), h("input", { class: "mk-input", value: "", placeholder: "학생에게 보일 안내 한 줄" }))],
    look: [h("div", { class: "mk-field" }, h("label", { text: "배경" }), chips), looks,
      h("div", { class: "mk-field" }, h("label", { text: "카드 색" }), h("div", { class: "mk-cards" }, h("i"), CARD_COLORS.map((c) => h("i", { "data-card": c.id, title: c.label }))))],
    layout: [h("div", { class: "mk-layouts" }, [["wall", "담벼락", "빈 곳부터 차곡차곡"], ["column", "칸", "칸마다 주제를 나눠"], ["grid", "묶음", "주제마다 한 줄씩"]].map(([k, l, s]) =>
      h("div", { class: "mk-layout" + (k === "column" ? " is-on" : "") }, mini(k), l, h("small", { text: s }))))],
    join: [h("div", { class: "mk-group" }, row("학생이 글을 쓸 수 있어요", "끄면 보기만 해요", true), row("선생님이 확인한 글만 보여요", "'보이기'를 눌러야 친구들에게 보여요", false),
      row("사진·영상·파일 올리기", "사진 10MB, 영상 50MB, 파일 20MB", true), row("친구 이름 보이기", "끄면 학생 화면에서 이름을 숨겨요", true))],
    react: [h("div", { class: "mk-group" }, row("댓글", null, true), row("댓글을 글 아래에 바로 보여요", "끄면 댓글 수만 보여요", true), row("좋아요", null, true), row("이모지 반응", null, true))],
    adv: [h("p", { class: "mk-li__sub", text: "보드를 지우면 글·댓글·사진·파일이 모두 지워져요. 되돌릴 수 없어요." }), h("button", { class: "mk-danger", type: "button", text: "보드 지우기" })],
  };
}
function settings() {
  const state = { bg: "gradient-sunset" };
  const P = panes(state);
  const paneEls = Object.fromEntries(TABS.map(([k]) => [k, h("section", { class: "mk-pane", role: "tabpanel", hidden: k !== "basic" }, P[k])]));
  const pick = (k, list) => { list.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === k))); Object.entries(paneEls).forEach(([kk, el]) => (el.hidden = kk !== k)); };
  const tabBtn = (k, l, i, withIcon) => h("button", { type: "button", role: "tab", "data-tab": k, "aria-selected": String(k === "basic") }, withIcon ? ico(i) : null, l);
  const head = h("div", { class: "mk-set__head" }, h("h2", { text: "보드 설정" }), h("button", { class: "mk-x", type: "button", "aria-label": "닫기", text: "×" }));
  const foot = h("div", { class: "mk-set__foot" }, h("button", { class: "mk-tbtn", type: "button", text: "취소" }), h("button", { class: "mk-tbtn mk-tbtn--main", type: "button", text: "저장" }));
  if (V === "b") {
    const vt = h("div", { class: "mk-vtabs", role: "tablist", "aria-label": "설정" }, TABS.map(([k, l, i]) => tabBtn(k, l, i, true)));
    vt.addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b) pick(b.dataset.tab, vt); });
    return h("div", { class: "mk-set mk-set--side", role: "dialog", "aria-label": "보드 설정" }, head, h("div", { class: "mk-set__body" }, vt, h("div", {}, Object.values(paneEls))), foot);
  }
  const tabs = h("div", { class: "mk-tabs", role: "tablist", "aria-label": "설정" }, TABS.map(([k, l, i]) => tabBtn(k, l, i, false)));
  tabs.addEventListener("click", (e) => { const b = e.target.closest("[role=tab]"); if (b) pick(b.dataset.tab, tabs); });
  if (V === "c") {
    const prev = h("aside", { class: "mk-prev" }, h("small", { text: "미리보기" }),
      h("div", { class: "mk-prev__box", "data-bg": state.bg, "data-live-bg": true }, h("b", { text: "기상캐스터 일기예보 만들기" }),
        h("div", { class: "mk-post" }, h("b", { text: "내일은 맑음" }), "미세먼지 보통"), h("div", { class: "mk-post" }, h("b", { text: "비 소식" }), "우산을 챙겨요")));
    return h("div", { class: "mk-scrim" }, h("div", { class: "mk-set mk-set--modal", role: "dialog", "aria-label": "보드 설정" }, head, tabs,
      h("div", { class: "mk-set__body" }, h("div", {}, Object.values(paneEls)), prev), foot));
  }
  return h("div", { class: "mk-set mk-set--drawer", role: "dialog", "aria-label": "보드 설정" }, head, tabs, Object.values(paneEls), foot);
}
function boardScreen() {
  const post = (t, b) => h("div", { class: "mk-post" }, h("b", { text: t }), b);
  return h("div", { class: "mk-board", "data-bg": "gradient-sunset", "data-live-bg": true },
    h("div", { class: "mk-bbar" }, h("div", { class: "mk-bbar__title" }, h("small", { text: "박동희 · 10시간 전" }), h("b", { text: "기상캐스터 일기예보 만들기" })),
      h("button", { class: "mk-tbtn mk-tbtn--main", type: "button" }, "학생 초대"), h("button", { class: "mk-tbtn", type: "button" }, ico("show"), "슬라이드쇼"),
      h("button", { class: "mk-tbtn", type: "button", "aria-pressed": "true" }, ico("gear"), "설정")),
    h("div", { class: "mk-cols" },
      h("div", { class: "mk-col" }, h("b", { text: "5-2" }), post("내일은 맑음", "미세먼지 보통, 낮 기온 12도"), post("비 소식", "모레 오후부터 비가 와요. 우산을 챙겨요")),
      h("div", { class: "mk-col" }, h("b", { text: "5-3" }), post("바람이 강해요", "체감 온도가 낮아요"))),
    settings());
}

document.body.append(demoBar(), SCREEN === "board" ? boardScreen() : listScreen());
