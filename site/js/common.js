// 모아보드 화면 공통 도구. 교사·학생이 입력한 글은 모두 textContent 로만 넣어요(h()의 text·자식 글자).
import { h } from "/shared/ui.js";
export { h };
/** append/replaceChildren 은 null·false 를 글자로 넣으므로, 빈 값을 걸러서 넣어요 */
const only = (a) => a.flat().filter((x) => x != null && x !== false && x !== "");
export const put = (el, ...kids) => el.append(...only(kids));
export const fill = (el, ...kids) => el.replaceChildren(...only(kids));

export const SLUG = "moaboard";
export const APP_NAME = "모아보드";
export const VERSION = "1.0";   // 보드 목록 왼쪽 메뉴 아래에 보여요

export const LAYOUTS = [
  ["wall", "담벼락", "글이 빈 곳부터 차곡차곡 붙어요"],
  ["column", "칸", "칸(열)마다 주제를 나눠 붙여요"],
  ["grid", "묶음", "주제마다 한 줄씩 묶어 보여요"],
];
export const EMOJIS = ["👍", "😊", "😮", "👏", "🤔"];

export const LIMITS = {
  title: 60, body: 1000, comment: 200, boardTitle: 80, boardDesc: 200, section: 30, sections: 12,
  imageBytes: 10 * 1024 * 1024, fileBytes: 20 * 1024 * 1024, videoBytes: 50 * 1024 * 1024,
};
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
export const VIDEO_EXT = ["mp4", "webm", "mov", "m4v"];
export const FILE_EXT = ["pdf", "hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip"];

export function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  const d = new Date(iso);
  return s < 86400 * 7 ? `${Math.floor(s / 86400)}일 전` : `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
export function fileSize(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
export const fileExt = (name) => (String(name).split(".").pop() || "").toLowerCase();

/** 고를 파일 검사: 문제가 없으면 null, 있으면 고치는 방법을 함께 쓴 문구 */
/** 올리기 전 화면 검사. 사진은 올릴 때 줄어드니(공통 파일 모듈) 크기는 줄인 뒤 공통 모듈이 확인해요 */
export function checkFile(file, kind, { beforeShrink = kind === "image" } = {}) {
  if (kind === "image") {
    if (!IMAGE_TYPES.includes(file.type)) return "사진은 PNG, JPG, GIF, WEBP 파일만 올릴 수 있어요.";
    if (!beforeShrink && file.size > LIMITS.imageBytes) return "사진이 10MB보다 커요. 크기를 줄여서 다시 골라 주세요.";
  } else if (kind === "video") {
    if (!VIDEO_EXT.includes(fileExt(file.name))) return "영상은 MP4, WEBM, MOV 파일만 올릴 수 있어요.";
    if (file.size > LIMITS.videoBytes) return "영상이 50MB보다 커요. 짧게 자르거나 화질을 낮춰서 다시 골라 주세요.";
  } else {
    if (!FILE_EXT.includes(fileExt(file.name))) return `이 파일은 올릴 수 없어요. ${FILE_EXT.join(", ")} 파일만 돼요.`;
    if (file.size > LIMITS.fileBytes) return "파일이 20MB보다 커요. 나눠서 올리거나 크기를 줄여 주세요.";
  }
  return null;
}

// ---- 아이콘(SVG 선 그림, 글자색을 따라가요) ----
const NS = "http://www.w3.org/2000/svg";
const PATHS = {
  plus: "M8 3v10M3 8h10",
  star: "M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z",
  folder: "M2 4.5v8h12V6H8L6.5 4.5z",
  trash: "M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9",
  clock: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3l2 1.2",
  undo: "M5 6H11a3 3 0 0 1 0 6H8M5 6l2.5-2.5M5 6l2.5 2.5",
  play: "M5 3.5v9l7-4.5z",
  pause: "M5 3.5v9M11 3.5v9",
  prev: "M10 3.5 5.5 8l4.5 4.5",
  next: "M6 3.5 10.5 8 6 12.5",
  close: "M4 4l8 8M12 4l-8 8",
  gear: "M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  show: "M2 3h12v8H2zM6 14h4M8 11v3",
  qr: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM10 10h1.5v1.5H10zM12.5 12.5H14V14h-1.5zM9 13h2v1H9zM13 9h1v2h-1z",
  more: "M3.5 8h.01M8 8h.01M12.5 8h.01",
  heart: "M8 13.5S2.5 10 2.5 6.2A2.7 2.7 0 0 1 8 4.8a2.7 2.7 0 0 1 5.5 1.4C13.5 10 8 13.5 8 13.5z",
  chat: "M2.5 3.5h11v7H6l-3.5 3v-3h0z",
  smile: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM5.5 9.5s.9 1.5 2.5 1.5 2.5-1.5 2.5-1.5M6 6.5h.01M10 6.5h.01",
  clip: "M10.5 4.5 5.8 9.2a1.4 1.4 0 0 0 2 2l5-5a2.8 2.8 0 0 0-4-4l-5 5a4.2 4.2 0 0 0 6 6l4.2-4.2",
  image: "M2 3h12v10H2zM2 11l3.5-3.5 3 3 2-2L14 12M10.5 6.5h.01",
  video: "M2 4h9v8H2zM11 7l3-2v6l-3-2",
  search: "M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10.3 10.3 13.5 13.5",
  check: "M3 8.5 6.5 12 13 4.5",
  grip: "M6 3.5h.01M10 3.5h.01M6 8h.01M10 8h.01M6 12.5h.01M10 12.5h.01",
  up: "M3.5 10 8 5.5l4.5 4.5",
  down: "M3.5 6 8 10.5 12.5 6",
};
export function icon(name, cls = "mb-ico") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", PATHS[name] || "");
  p.setAttribute("fill", name === "play" ? "currentColor" : "none");   // 별은 CSS 가 채워요(즐겨찾기)
  p.setAttribute("stroke", "currentColor");
  p.setAttribute("stroke-width", name === "more" || name === "grip" ? "2.6" : "1.6");
  p.setAttribute("stroke-linecap", "round");
  p.setAttribute("stroke-linejoin", "round");
  svg.append(p);
  return svg;
}
/** 아이콘 + 글자 버튼(글자는 좁은 화면에서 숨길 수 있게 span) */
export const iconBtn = (name, label, props = {}) =>
  h("button", { type: "button", ...props }, icon(name), h("span", { class: "mb-btnlabel", text: label }));

/** 공통 팝업 틀(ss-scrim > ss-modal). 닫으면 지우고 원래 자리로 포커스를 돌려요 */
export function modal({ title, wide = false, cls = "", onClose } = {}) {
  const tid = `mb-m-${Math.random().toString(36).slice(2, 8)}`;
  const body = h("div", { class: "ss-modal__body" });
  const foot = h("div", { class: "ss-modal__foot" });
  const head = h("div", { class: "ss-modal__head" }, h("h2", { id: tid, text: title }));
  const box = h("div", { class: `ss-modal${wide ? " ss-modal--wide" : ""} ${cls}`.trim() }, head, body, foot);
  const scrim = h("div", { class: "ss-scrim", role: "dialog", "aria-modal": "true", "aria-labelledby": tid }, box);
  const last = document.activeElement;
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  function close() { scrim.remove(); removeEventListener("keydown", onKey, true); last?.focus?.(); onClose?.(); }
  addEventListener("keydown", onKey, true);
  scrim.addEventListener("mousedown", (e) => { if (e.target === scrim) close(); });
  document.body.append(scrim);
  return { scrim, box, head, body, foot, close, focus: () => box.querySelector("[data-autofocus], input, textarea, select, button")?.focus() };
}

/** 오류에서 화면에 보여 줄 문구: 서버·공통 모듈이 준 한국어 안내, 없으면 fallback */
export const userMsg = (e, fallback) => e?.userMessage || (/[가-힣]/.test(e?.message || "") ? e.message : fallback);

export function toast(text, opt) { window.SSUI?.toast(text, opt); }

/** 확인 창(지우기 등 되돌릴 수 없는 일에만) */
export function confirmBox({ title, text, ok = "지우기", danger = true }) {
  return new Promise((done) => {
    let answered = false;
    const m = modal({ title, onClose: () => { if (!answered) done(false); } });
    m.body.append(h("p", { text }));
    const yes = h("button", { class: `ss-btn ${danger ? "ss-btn--danger" : "ss-btn--main"}`, type: "button", text: ok,
      onclick: () => { answered = true; m.close(); done(true); } });
    m.foot.append(h("button", { class: "ss-btn", type: "button", text: "취소", onclick: () => m.close() }), yes);
    yes.focus();
  });
}

export const errorBox = (text, retry) => h("div", { class: "ss-alert ss-alert--error mb-error", role: "alert" },
  h("span", { text }), retry && h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "다시 시도", onclick: retry }));

/** 영상: 카드·글 보기·슬라이드쇼에 첫 장면을 미리보기로 보여 주고, 누르면 재생(#t=0.1 은 iPad·iPhone 에서도 첫 장면이 보이게) */
export function videoEl(v, { cls = "mb-video", label = "" } = {}) {
  return h("video", { class: cls, src: v.url ? `${v.url}#t=0.1` : null, controls: true, preload: "metadata", playsinline: true,
    "aria-label": label || `영상 ${v.name || ""}`.trim() });
}
