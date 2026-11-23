// 슬라이드쇼: 글을 한 장씩 크게(프로젝터·TV용 검은 바탕). ← → 넘기기, Space 재생·멈춤, Esc 닫기
import { h, fill, icon, iconBtn, fileSize, videoEl } from "./common.js";

const SPEEDS = [3, 5, 8, 10];

export function openSlideshow({ posts, board, showName, start = 0 }) {
  let i = Math.min(start, posts.length - 1), playing = false, timer = null, sec = 5;
  const last = document.activeElement;
  const slide = h("div", { class: "mb-show__slide", "aria-live": "polite" });
  const count = h("span", { class: "mb-show__count" });
  const playBtn = iconBtn("play", "재생", { class: "mb-show__btn", "aria-label": "자동 넘기기 시작 (Space)" });
  const speed = h("select", { class: "mb-show__speed", "aria-label": "넘기는 간격" }, SPEEDS.map((s) => h("option", { value: s, text: `${s}초` })));
  speed.value = String(sec);
  const box = h("div", { class: "mb-show", "data-ss-palette": "a", role: "dialog", "aria-modal": "true", "aria-label": `${board.title} 슬라이드쇼` },
    h("div", { class: "mb-show__top" },
      h("span", { class: "mb-show__name", text: board.title }), h("span", { class: "mb-card__sp" }), count,
      iconBtn("close", "닫기", { class: "mb-show__btn", "aria-label": "슬라이드쇼 닫기 (Esc)", onclick: () => close() })),
    h("div", { class: "mb-show__stage" },
      iconBtn("prev", "이전", { class: "mb-show__nav", "aria-label": "이전 글 (←)", onclick: () => go(-1) }),
      slide,
      iconBtn("next", "다음", { class: "mb-show__nav", "aria-label": "다음 글 (→)", onclick: () => go(1) })),
    h("div", { class: "mb-show__bottom" }, playBtn, speed));

  function draw() {
    const p = posts[i];
    count.textContent = `${i + 1} / ${posts.length}`;
    fill(slide,
      p.image && h("img", { class: "mb-show__img", src: p.image, alt: p.title ? `${p.title} 사진` : "올린 사진" }),
      p.video && videoEl(p.video, { cls: "mb-show__img mb-show__video" }),
      h("div", { class: "mb-show__text" },
        p.title && h("h2", { class: "mb-show__title", text: p.title }),
        p.body && h("p", { class: "mb-show__body", text: p.body }),
        p.file && h("p", { class: "mb-show__file" }, icon("clip"), ` ${p.file.name} · ${fileSize(p.file.size)}`),
        showName(p) && h("p", { class: "mb-show__author", text: showName(p) })));
  }
  // 영상을 재생하는 동안은 자동으로 넘기지 않고, 끝나면 다시 넘겨요
  slide.addEventListener("play", () => clearInterval(timer), true);
  slide.addEventListener("ended", () => { if (playing) restart(); }, true);
  function go(d) { slide.querySelector("video")?.pause(); i = (i + d + posts.length) % posts.length; draw(); if (playing) restart(); }
  function restart() { clearInterval(timer); timer = setInterval(() => go(1), sec * 1000); }
  function setPlay(on) {
    playing = on;
    playBtn.replaceChildren(icon(on ? "pause" : "play"), h("span", { class: "mb-btnlabel", text: on ? "멈춤" : "재생" }));
    playBtn.setAttribute("aria-label", on ? "자동 넘기기 멈춤 (Space)" : "자동 넘기기 시작 (Space)");
    if (on) restart(); else clearInterval(timer);
  }
  playBtn.onclick = () => setPlay(!playing);
  speed.onchange = () => { sec = Number(speed.value); if (playing) restart(); };
  const onKey = (e) => {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === " " && e.target.tagName !== "SELECT") { e.preventDefault(); setPlay(!playing); }
  };
  function close() {
    clearInterval(timer); removeEventListener("keydown", onKey, true); box.remove();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    last?.focus?.();
  }
  addEventListener("keydown", onKey, true);
  document.body.append(box);
  box.requestFullscreen?.().catch(() => {});   // 전체 화면이 막혀 있어도 창 안에서 그대로 보여요
  draw();
  playBtn.focus();
}
