// 교사 첫 화면(보드 목록): 왼쪽 메뉴(최근 · 즐겨찾기 · 휴지통 · 폴더) + 오른쪽 카드 격자
// 휴지통: 보드를 옮기면 학생은 못 들어와요. 30일이 지나면 목록을 열 때 영구 삭제해요.
import { h, put, fill, icon, modal, confirmBox, errorBox, timeAgo, toast, LAYOUTS, APP_NAME, VERSION } from "./common.js";
import { openBoardDialog } from "./dialogs.js";

const TRASH_DAYS = 30;
const VIEW_KEY = "moaboard:view";
const loadView = () => { try { return JSON.parse(localStorage.getItem(VIEW_KEY) || "null") || { kind: "recent" }; } catch { return { kind: "recent" }; } };
const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, JSON.stringify(v)); } catch { /* 저장 불가면 이번만 */ } };

export async function mountList({ root, api, bar, openNew = false, onOpen, userName = "" }) {
  let boards = [], folders = [], view = loadView(), sort = "recent", query = "", menuEl = null;
  root.classList.add("mb-app--list");

  const nav = h("nav", { class: "mb-nav", "aria-label": "보드 모음" });
  const search = h("label", { class: "mb-search" }, icon("search"),
    h("input", { type: "search", class: "mb-search__input", placeholder: "보드 찾기", "aria-label": "보드 찾기",
      oninput: (e) => { query = e.target.value.trim().toLowerCase(); drawMain(); } }));
  const side = h("aside", { class: "mb-side", "aria-label": "모아보드 메뉴" },
    h("div", { class: "mb-side__hello" }, h("b", { text: userName ? `${userName} 선생님` : "선생님" }), h("span", { text: "오늘은 어떤 생각을 모아 볼까요?" })),
    search, nav, h("p", { class: "mb-side__ver", text: `${APP_NAME} v${VERSION}` }));
  const main = h("section", { class: "mb-main" });
  root.replaceChildren(h("div", { class: "mb-shell" }, side, main));
  // 새 보드는 격자 맨 앞 "+ 새 보드 만들기" 카드로 만들어요(왼쪽 메뉴·상단에는 버튼을 두지 않음)

  const closeMenu = () => { menuEl?.remove(); menuEl = null; };
  addEventListener("click", closeMenu);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  function popMenu(anchor, items) {
    closeMenu();
    menuEl = h("div", { class: "mb-menu", role: "menu" }, items.filter(Boolean).map(([label, fn, danger]) =>
      h("button", { type: "button", role: "menuitem", class: danger ? "is-danger" : "", text: label, onclick: (e) => { e.stopPropagation(); closeMenu(); fn(); } })));
    anchor.after(menuEl);
    menuEl.querySelector("button")?.focus();
  }
  const guard = (p, ok) => Promise.resolve(p).then(() => { if (ok) toast(ok); return true; },
    (e) => { console.error(e); toast(e?.userMessage || "저장하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요."); return false; });

  // ---- 데이터 ----
  const active = () => boards.filter((b) => !b.deleted_at);
  const trashed = () => boards.filter((b) => b.deleted_at);
  function inView() {
    let list = view.kind === "trash" ? trashed() : active();
    if (view.kind === "fav") list = list.filter((b) => b.favorite);
    if (view.kind === "folder") list = list.filter((b) => b.folder_id === view.id);
    if (query) list = list.filter((b) => b.title.toLowerCase().includes(query));
    const t = (b) => b.last_opened_at || b.updated_at || "";
    return list.slice().sort(sort === "name" ? (a, b) => a.title.localeCompare(b.title, "ko") : (a, b) => t(b).localeCompare(t(a)));
  }
  const viewName = () => view.kind === "fav" ? "즐겨찾기" : view.kind === "trash" ? "휴지통"
    : view.kind === "folder" ? (folders.find((f) => f.id === view.id)?.name || "폴더") : "최근";

  async function load() {
    main.replaceChildren(h("div", { class: "mb-boards", "aria-busy": "true" }, [1, 2, 3, 4].map(() => h("div", { class: "mb-bcard mb-bcard--sk", "aria-hidden": "true" },
      h("div", { class: "ss-skeleton mb-bcard__thumb" }), h("div", { class: "ss-skeleton mb-sk" })))));
    try { [boards, folders] = await Promise.all([api.listBoards(), api.listFolders()]); }
    catch (e) { console.error(e); main.replaceChildren(errorBox("보드 목록을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.", load)); return; }
    // 휴지통에서 30일 지난 보드는 영구 삭제
    const old = trashed().filter((b) => Date.now() - new Date(b.deleted_at).getTime() > TRASH_DAYS * 86400e3);
    for (const b of old) { try { await api.deleteBoard(b.id); boards = boards.filter((x) => x.id !== b.id); } catch { /* 다음에 다시 */ } }
    if (view.kind === "folder" && !folders.some((f) => f.id === view.id)) view = { kind: "recent" };
    draw();
  }
  function go(v) { view = v; saveView(v); query = ""; search.querySelector("input").value = ""; draw(); }
  function draw() { drawNav(); drawMain(); }

  // ---- 왼쪽 메뉴 ----
  function drawNav() {
    const item = (v, ic, label, n, extra) => h("div", { class: "mb-nav__item", "aria-current": view.kind === v.kind && view.id === v.id ? "page" : null },
      h("button", { class: "mb-nav__go", type: "button", onclick: () => go(v) }, icon(ic), h("span", { text: label }), n != null && h("small", { text: String(n) })), extra);
    fill(nav,
      item({ kind: "recent" }, "clock", "최근", active().length),
      item({ kind: "fav" }, "star", "즐겨찾기", active().filter((b) => b.favorite).length),
      item({ kind: "trash" }, "trash", "휴지통", trashed().length),
      h("p", { class: "mb-nav__label", text: "폴더" }),
      folders.map((f) => item({ kind: "folder", id: f.id }, "folder", f.name, active().filter((b) => b.folder_id === f.id).length,
        h("button", { class: "mb-iconbtn", type: "button", "aria-label": `${f.name} 폴더 메뉴`, onclick: (e) => { e.stopPropagation(); popMenu(e.currentTarget, [
          ["이름 바꾸기", () => nameDialog({ title: "폴더 이름 바꾸기", value: f.name, ok: "바꾸기", onOk: async (t) => { if (await guard(api.renameFolder(f.id, t))) { f.name = t; draw(); } } })],
          ["폴더 지우기", async () => {
            const ok = await confirmBox({ title: "폴더를 지울까요?", text: `'${f.name}' 폴더만 지워져요. 안에 있던 보드는 지우지 않고 '최근'에 그대로 있어요.` });
            if (ok && await guard(api.deleteFolder(f.id), "폴더를 지웠어요")) { folders = folders.filter((x) => x.id !== f.id); boards.forEach((b) => { if (b.folder_id === f.id) b.folder_id = null; }); if (view.id === f.id) go({ kind: "recent" }); else draw(); }
          }, true]]); } }, icon("more")))),
      h("div", { class: "mb-nav__item mb-nav__add" }, h("button", { class: "mb-nav__go", type: "button", onclick: () => nameDialog({ title: "새 폴더", value: "", ok: "만들기",
        onOk: async (t) => { try { const f = await api.createFolder(t); folders.push(f); go({ kind: "folder", id: f.id }); } catch (e) { toast(e?.userMessage || "폴더를 만들지 못했어요. 다시 해 주세요."); } } }) },
        icon("plus"), h("span", { text: "새 폴더" }))));
  }

  // ---- 오른쪽 ----
  function drawMain() {
    const list = inView(), trash = view.kind === "trash";
    const sortBox = h("div", { class: "mb-sort", role: "group", "aria-label": "정렬" },
      [["recent", "최근 사용"], ["name", "이름"]].map(([k, l]) => h("button", { type: "button", "aria-pressed": String(sort === k), text: l, onclick: () => { sort = k; drawMain(); } })));
    const head = h("header", { class: "mb-main__head" }, h("h1", { class: "mb-title", text: viewName() }),
      trash && trashed().length > 0 && h("button", { class: "ss-btn ss-btn--danger ss-btn--sm", type: "button", text: "휴지통 비우기", onclick: emptyTrash }),
      sortBox);
    let body;
    if (!boards.length) {
      body = h("div", { class: "ss-empty mb-empty" }, h("b", { text: "아직 만든 보드가 없어요" }),
        h("span", { text: "새 보드를 만들고 학생 초대로 학생을 들여보내 보세요." }),
        h("button", { class: "ss-btn ss-btn--main", type: "button", onclick: () => create() }, icon("plus"), " 새 보드 만들기"));
    } else {
      const canNew = !trash && view.kind !== "fav" && !query;
      const empty = !list.length && h("p", { class: "mb-list__empty", text: query ? `'${query}' 보드가 없어요`
        : trash ? "휴지통이 비어 있어요" : view.kind === "fav" ? "보드 카드의 별을 누르면 여기에 모여요" : view.kind === "folder" ? "이 폴더에 보드가 없어요. 보드 메뉴의 '폴더로 옮기기'로 넣을 수 있어요" : "보드가 없어요" });
      body = h("div", { class: "mb-boards" },
        canNew && h("button", { class: "mb-bcard mb-bcard--new", type: "button", onclick: () => create() },
          h("span", { class: "mb-bcard__thumb" }, icon("plus")), h("span", { class: "mb-bcard__title", text: "새 보드 만들기" })),
        list.map((b) => trash ? trashCard(b) : boardCard(b)), empty);
    }
    fill(main, head, trash && h("p", { class: "mb-trashnote", text: `휴지통의 보드는 학생이 들어올 수 없고, ${TRASH_DAYS}일이 지나면 영구 삭제돼요.` }), body);
  }

  const thumb = (b) => h("span", { class: "mb-bcard__thumb", "data-bg": b.bg_image ? null : b.bg_preset || null, "aria-hidden": "true" },
    b.bg_image && h("img", { class: "mb-bcard__photo", src: b.bg_image, alt: "", loading: "lazy" }),
    b.pending_count > 0 && h("span", { class: "ss-badge ss-badge--expired mb-bcard__badge", text: `확인 기다림 ${b.pending_count}` }));
  const meta = (b) => `${(LAYOUTS.find(([k]) => k === b.layout) || [, ""])[1]} · 글 ${b.post_count ?? 0}개 · ${timeAgo(b.last_opened_at || b.updated_at)}`;

  function boardCard(b) {
    const open = (e) => { e.preventDefault(); onOpen(b.id, b.title); };
    const href = `?c=${encodeURIComponent(b.id)}`;
    const card = h("div", { class: "mb-bcard" },
      h("a", { class: "mb-bcard__open", href, tabindex: "-1", "aria-hidden": "true", onclick: open }, thumb(b)),
      h("button", { class: "mb-bcard__star", type: "button", "aria-pressed": String(!!b.favorite), "aria-label": b.favorite ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기",
        onclick: (e) => { e.stopPropagation(); toggleFav(b); } }, icon("star")),
      h("span", { class: "mb-bcard__row" }, h("a", { class: "mb-bcard__title", href, text: b.title, onclick: open }),
        h("button", { class: "mb-iconbtn", type: "button", "aria-label": `${b.title} 보드 메뉴`, "aria-haspopup": "menu",
          onclick: (e) => { e.stopPropagation(); popMenu(e.currentTarget, [
            ["열기", () => onOpen(b.id, b.title)],
            [b.favorite ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기", () => toggleFav(b)],
            ["폴더로 옮기기", () => moveDialog(b)],
            ["휴지통으로", async () => { if (await guard(api.trashBoard(b.id), "휴지통으로 옮겼어요")) { b.deleted_at = new Date().toISOString(); draw(); } }, true]]); } }, icon("more"))),
      h("span", { class: "mb-bcard__meta", text: meta(b) }));
    return card;
  }
  function trashCard(b) {
    return h("div", { class: "mb-bcard" }, thumb(b), h("span", { class: "mb-bcard__title", text: b.title }),
      h("span", { class: "mb-bcard__meta", text: `휴지통에 넣은 지 ${timeAgo(b.deleted_at)}` }),
      h("div", { class: "mb-bcard__acts" },
        h("button", { class: "ss-btn ss-btn--sm", type: "button", onclick: async () => { if (await guard(api.restoreBoard(b.id), "되살렸어요")) { b.deleted_at = null; draw(); } } }, icon("undo"), " 되살리기"),
        h("button", { class: "ss-btn ss-btn--sm ss-btn--danger", type: "button", text: "영구 삭제", onclick: async () => {
          const ok = await confirmBox({ title: "영구 삭제할까요?", text: `'${b.title}' 보드와 글·댓글·사진·파일이 모두 지워져요. 되돌릴 수 없어요.` });
          if (ok && await guard(api.deleteBoard(b.id), "영구 삭제했어요")) { boards = boards.filter((x) => x.id !== b.id); draw(); }
        } })));
  }
  async function emptyTrash() {
    const list = trashed();
    const ok = await confirmBox({ title: "휴지통을 비울까요?", text: `보드 ${list.length}개와 그 안의 글·사진·파일이 모두 지워져요. 되돌릴 수 없어요.` });
    if (!ok) return;
    for (const b of list) if (await guard(api.deleteBoard(b.id))) boards = boards.filter((x) => x.id !== b.id);
    toast("휴지통을 비웠어요"); draw();
  }
  async function toggleFav(b) { const v = !b.favorite; if (await guard(api.setBoardMeta(b.id, { favorite: v }))) { b.favorite = v; draw(); } }

  function moveDialog(b) {
    const m = modal({ title: "폴더로 옮기기", cls: "mb-dlg" });
    const sel = h("select", { class: "ss-select", id: "mb-mv-folder" }, h("option", { value: "", text: "폴더 없음" }), folders.map((f) => h("option", { value: f.id, text: f.name })));
    sel.value = b.folder_id || "";
    put(m.body, !folders.length && h("p", { class: "mb-hint", text: "아직 폴더가 없어요. 왼쪽 메뉴의 '새 폴더'로 먼저 만들어 주세요." }),
      h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-mv-folder", text: "폴더" }), sel));
    m.foot.append(h("button", { class: "ss-btn", type: "button", text: "취소", onclick: () => m.close() }),
      h("button", { class: "ss-btn ss-btn--main", type: "button", text: "옮기기", onclick: async () => {
        const id = sel.value || null;
        if (await guard(api.setBoardMeta(b.id, { folder_id: id }), "옮겼어요")) { b.folder_id = id; m.close(); draw(); }
      } }));
    m.focus();
  }
  function nameDialog({ title, value, ok, onOk }) {
    const m = modal({ title, cls: "mb-dlg" });
    const err = h("div", { class: "ss-alert ss-alert--error", role: "alert", hidden: true });
    const input = h("input", { class: "ss-input", id: "mb-folder-name", maxlength: 30, value, "data-autofocus": true });
    const go2 = async () => { const t = input.value.trim(); if (!t) { err.textContent = "이름을 적어 주세요."; err.hidden = false; return; } m.close(); await onOk(t); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go2(); });
    m.body.append(err, h("label", { class: "ss-label", for: "mb-folder-name", text: "이름" }), input);
    m.foot.append(h("button", { class: "ss-btn", type: "button", text: "취소", onclick: () => m.close() }), h("button", { class: "ss-btn ss-btn--main", type: "button", text: ok, onclick: go2 }));
    m.focus(); input.select();
  }

  function create() {
    openBoardDialog({ onSave: async (v) => {
      try { const b = await api.createBoard({ ...v, folder_id: view.kind === "folder" ? view.id : null }); onOpen(b.id, b.title); }
      catch (e) { console.error(e); return e?.userMessage || "만들지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요."; }
    } });
  }

  await load();
  if (openNew) create();
  return { reload: load };
}
