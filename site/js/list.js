// 교사 첫 화면: 내 보드 목록 + 새 보드 만들기
import { h, icon, errorBox, timeAgo, LAYOUTS, toast } from "./common.js";
import { openBoardDialog } from "./dialogs.js";

export async function mountList({ root, api, bar, openNew = false, onOpen }) {
  let boards = [], query = "";
  const grid = h("div", { class: "mb-boards" });
  const search = h("label", { class: "mb-search" }, icon("search"),
    h("input", { type: "search", class: "mb-search__input", placeholder: "보드 찾기", "aria-label": "보드 찾기",
      oninput: (e) => { query = e.target.value.trim().toLowerCase(); draw(); } }));
  const newBtn = h("button", { class: "ss-btn ss-btn--main", type: "button", onclick: () => create() }, icon("plus"), " 새 보드");
  root.replaceChildren(
    h("header", { class: "mb-head" },
      h("div", { class: "mb-head__text" }, h("h1", { class: "mb-title", text: "내 보드" }),
        h("p", { class: "mb-meta", text: "학생들의 생각을 한곳에 모아요. 보드를 눌러 열어요." })),
      h("div", { class: "mb-head__tools" }, search, newBtn)),
    grid);
  bar?.addAction("새 보드", () => create());

  function create() {
    openBoardDialog({ onSave: async (v) => {
      try { const b = await api.createBoard(v); onOpen(b.id, b.title); }
      catch { return "만들지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."; }
    } });
  }

  async function load() {
    grid.replaceChildren(...[1, 2, 3, 4].map(() => h("div", { class: "mb-bcard mb-bcard--sk", "aria-hidden": "true" },
      h("div", { class: "ss-skeleton mb-sk mb-sk--thumb" }), h("div", { class: "ss-skeleton mb-sk" }), h("div", { class: "ss-skeleton mb-sk mb-sk--short" }))));
    grid.setAttribute("aria-busy", "true");
    try { boards = await api.listBoards(); }
    catch { grid.removeAttribute("aria-busy"); grid.replaceChildren(errorBox("보드 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.", load)); return; }
    grid.removeAttribute("aria-busy");
    draw();
  }

  function draw() {
    if (!boards.length) {
      grid.replaceChildren(h("div", { class: "ss-empty mb-empty" }, h("b", { text: "아직 만든 보드가 없어요" }),
        h("span", { text: "새 보드를 만들고 학생 초대로 학생을 들여보내 보세요." }),
        h("button", { class: "ss-btn ss-btn--main", type: "button", onclick: () => create() }, icon("plus"), " 새 보드 만들기")));
      return;
    }
    const list = boards.filter((b) => !query || b.title.toLowerCase().includes(query));
    if (!list.length) { grid.replaceChildren(h("p", { class: "mb-list__empty", text: `'${query}' 보드가 없어요` })); return; }
    grid.replaceChildren(...list.map((b) => {
      const layout = (LAYOUTS.find(([k]) => k === b.layout) || [, ""])[1];
      return h("a", { class: "mb-bcard", href: `?c=${encodeURIComponent(b.id)}`, onclick: (e) => { e.preventDefault(); onOpen(b.id, b.title); } },
        h("span", { class: "mb-bcard__thumb", "data-bg": b.bg_image ? null : b.bg_preset || null, "data-card": b.card_color || null, "aria-hidden": "true" },
          b.bg_image ? h("img", { class: "mb-bcard__photo", src: b.bg_image, alt: "", loading: "lazy" })
            : h("span", { class: `mb-mini mb-mini--${b.layout}` }, Array.from({ length: 6 }, () => h("i")))),
        h("span", { class: "mb-bcard__title", text: b.title }),
        h("span", { class: "mb-bcard__meta", text: `${layout} · 글 ${b.post_count}개 · ${timeAgo(b.updated_at)}` }),
        b.pending_count > 0 && h("span", { class: "ss-badge ss-badge--expired mb-bcard__badge", text: `확인 기다림 ${b.pending_count}` }));
    }));
  }

  await load();
  if (openNew) create();
  return { reload: load };
}
