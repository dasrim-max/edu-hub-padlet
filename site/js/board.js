// 보드 화면(교사·학생 공통). 교사: 모든 글 + 확인·옮기기·칸 관리 / 학생: 보이는 글 + 내 글, 한 번에 칸 하나
import { h, put, fill, icon, iconBtn, modal, confirmBox, toast, timeAgo, errorBox, LIMITS, videoEl } from "./common.js";
import { openCompose, openPostDetail, openBoardDialog, fileChip, reactionBar } from "./dialogs.js";
import { openSlideshow } from "./slideshow.js";
import { bgPreset, cardColor } from "./board-style.js";

/**
 * @param o.root      그릴 곳
 * @param o.api       저장소(api-demo.js 와 같은 함수들)
 * @param o.boardId
 * @param o.role      "teacher" | "student"
 * @param o.me        학생이면 { name }
 * @param o.bar       교사 앱 메뉴(addAction(label, fn))
 * @param o.onInvite  학생 초대 창 열기(board)
 * @param o.onDeleted 보드를 지운 뒤
 */
export async function mountBoard({ root, api, boardId, role, me = {}, bar, onInvite, onDeleted, onTitle }) {
  const teacher = role === "teacher";
  /** 저장이 안 되면 알림으로 알려요(서버가 준 문구가 있으면 그대로). 됐으면 true */
  const guard = (p) => Promise.resolve(p).then(() => true, (e) => { console.error(e); toast(e?.userMessage || "저장하지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요."); return false; });
  let data = null, query = "", onlyPending = false, stuSection = null, dragging = null, dirty = false;

  // 불러오는 중
  root.replaceChildren(h("div", { class: "mb-loading", "aria-busy": "true", "aria-label": "보드를 불러오는 중" },
    h("div", { class: "ss-skeleton mb-sk mb-sk--title" }), h("div", { class: "mb-sk-row" }, [1, 2, 3].map(() => h("div", { class: "ss-skeleton mb-sk mb-sk--card" })))));

  /** quiet: 실시간·주기 다시 읽기. 잠깐 끊겨도 보던 화면을 그대로 둬요 */
  async function load(quiet = false) {
    let next;
    try { next = await api.getBoard(boardId); }
    catch (e) { if (quiet && data) return false; console.error(e); root.replaceChildren(errorBox(e?.userMessage || "보드를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.", () => location.reload())); return false; }
    data = next;
    if (!data) {
      root.replaceChildren(h("div", { class: "ss-empty mb-empty" }, h("b", { text: "보드를 찾지 못했어요" }),
        h("span", { text: teacher ? "지워졌거나 주소가 바뀌었어요. 보드 목록에서 다시 골라 주세요." : "선생님께 확인해 주세요." }),
        teacher && h("a", { class: "ss-btn", href: "./", text: "보드 목록" })));
      return false;
    }
    return true;
  }
  if (!(await load())) return;

  /** 보드 꾸미기: <html data-mb-bg · data-mb-card> + 배경 사진(화면 뒤에 깔기). 색·무늬는 css/moaboard-style.css */
  let photoEl = null;
  function applyLook(b) {
    const root = document.documentElement;
    const bg = b.bg_image ? "photo" : bgPreset(b.bg_preset) ? b.bg_preset : null;
    if (bg) root.setAttribute("data-mb-bg", bg); else root.removeAttribute("data-mb-bg");
    if (cardColor(b.card_color)) root.setAttribute("data-mb-card", b.card_color); else root.removeAttribute("data-mb-card");
    if (b.bg_image) {
      photoEl ??= h("img", { class: "mb-bgphoto", alt: "", "aria-hidden": "true" });
      if (photoEl.getAttribute("src") !== b.bg_image) photoEl.src = b.bg_image;
      if (!photoEl.isConnected) document.body.prepend(photoEl);
    } else photoEl?.remove();
  }
  applyLook(data.board);
  onTitle?.(data.board.title);

  // ---- 교사 앱 메뉴 ----
  if (teacher && bar) {
    bar.addAction("학생 초대", () => onInvite?.(data.board));
    bar.addAction("슬라이드쇼", () => {
      const list = ordered().filter((p) => p.status === "visible");
      if (!list.length) return toast("보여 줄 글이 아직 없어요");
      openSlideshow({ posts: list, board: data.board, showName });
    });
    let picked = null;   // 설정 창에서 마지막으로 미리 본 꾸미기(사진 주소 포함)
    bar.addAction("보드 설정", () => openBoardDialog({ board: data.board,
      upload: (f) => api.uploadFile(f, "image", { max: 1920 }),   // 배경 사진은 크게 보여 주니 1920px
      onPreview: (look) => { picked = look; applyLook({ ...data.board, ...look }); },
      onClose: () => applyLook(data.board),   // 저장했으면 새 값, 취소했으면 원래 꾸미기
      onSave: async (v) => {
        try {
          await api.updateBoard(boardId, v);
          data.board = { ...data.board, ...v, bg_image: v.bg_image_path ? (picked?.bg_image ?? data.board.bg_image) : null };
          toast("저장했어요");
        } catch (e) { return e?.userMessage || "저장하지 못했어요. 다시 시도해 주세요."; } },
      onDelete: async () => { if (await guard(api.trashBoard(boardId))) { toast("휴지통으로 옮겼어요"); onDeleted?.(); } } }));
  }

  const head = h("header", { class: "mb-head" });
  const stage = h("div", { class: "mb-stage" });
  const fab = h("div", { class: "mb-fab" });
  root.replaceChildren(head, stage, fab);

  // ---- 보이는 이름 ----
  function showName(x) {
    if (x.by_teacher) return "선생님";
    if (teacher) return x.author;
    if (x.mine) return "나";
    return data.board.show_names ? x.author : "";
  }
  const canEdit = (p) => teacher || (p.mine && !p.by_teacher);
  const sections = () => data.board.layout === "wall" ? [] : data.sections;
  const matches = (p) => {
    if (!teacher && p.status !== "visible" && !p.mine) return false;   // 학생: 확인 전 글은 내 글만(개발 시: 서버가 빼고 보내요)
    if (onlyPending && p.status !== "pending") return false;
    if (!query) return true;
    const t = `${p.title} ${p.body} ${p.author} ${p.file?.name || ""}`.toLowerCase();
    return t.includes(query);
  };
  /** 화면 순서: 칸 순서 → 칸 안 순서. 담벼락은 쓴 순서 */
  function ordered() {
    const ps = data.posts.filter(matches);
    if (data.board.layout === "wall") return ps.sort((a, b) => a.created_at.localeCompare(b.created_at));
    const order = new Map(sections().map((s, i) => [s.id, i]));
    const rank = (p) => (p.section_id && order.has(p.section_id) ? order.get(p.section_id) : -1);
    return ps.sort((a, b) => rank(a) - rank(b) || a.position - b.position);
  }
  const inSection = (sid) => ordered().filter((p) => (sections().some((s) => s.id === p.section_id) ? p.section_id : null) === sid);

  // ---- 글 카드 ----
  function card(p, { big = false } = {}) {
    const pending = p.status === "pending";
    const el = h("article", { class: "mb-card" + (pending ? " is-pending" : "") + (p.mine && !teacher ? " is-mine" : "") + (big ? " mb-card--big" : ""),
      "data-id": p.id, tabindex: "0", "aria-label": `${p.title || "제목 없는 글"}${showName(p) ? `, ${showName(p)}` : ""}` });
    const top = h("div", { class: "mb-card__top" },
      pending && h("span", { class: "ss-badge ss-badge--expired mb-card__badge", text: teacher ? "확인 기다림" : "선생님 확인 중" }),
      teacher && data.board.layout !== "wall" && h("span", { class: "mb-card__grip", title: "끌어서 옮기기" }, icon("grip")),
      h("span", { class: "mb-card__sp" }),
      canEdit(p) && h("button", { class: "mb-iconbtn", type: "button", "aria-label": "글 메뉴", "aria-haspopup": "menu", onclick: (e) => { e.stopPropagation(); postMenu(p, e.currentTarget); } }, icon("more")));
    put(el, top,
      p.image && h("img", { class: "mb-card__img", src: p.image, alt: p.title ? `${p.title} 사진` : "올린 사진", loading: "lazy" }),
      p.video && videoEl(p.video, { cls: "mb-card__video", label: `${p.title || "글"} 영상` }),
      p.title && h("h3", { class: "mb-card__title", text: p.title }),
      p.body && h("p", { class: "mb-card__body", text: p.body }),
      p.file && fileChip(p.file),
      pending && teacher && h("div", { class: "mb-card__approve" },
        h("button", { class: "ss-btn ss-btn--sm ss-btn--main", type: "button", onclick: async (e) => { e.stopPropagation(); if (await guard(api.approvePost(p.id))) toast("친구들에게 보여요"); } }, icon("check"), " 보이기"),
        h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "지우기", onclick: (e) => { e.stopPropagation(); removePost(p); } })),
      h("footer", { class: "mb-card__foot" },
        h("span", { class: "mb-card__meta", text: [showName(p), timeAgo(p.created_at)].filter(Boolean).join(" · ") }),
        !pending && reactionBar(p, data.board, { big, onLike: () => guard(api.toggleLike(p.id)), onEmoji: (em) => guard(api.toggleEmoji(p.id, em)) }),
        !pending && data.board.allow_comments && h("button", { class: "mb-react mb-react--cmt", type: "button", "aria-label": `댓글 ${p.comments.length}개 보기`, onclick: (e) => { e.stopPropagation(); detail(p.id); } },
          icon("chat"), h("span", { text: String(p.comments.length) }))),
      !pending && inlineComments() && commentsBlock(p, big));
    el.addEventListener("click", (e) => { if (!e.target.closest("a,button,input,form,video,.mb-ccmts")) detail(p.id); });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === el) detail(p.id); });
    if (teacher && data.board.layout !== "wall") {
      el.draggable = true;
      el.addEventListener("dragstart", (e) => { dragging = p.id; el.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", p.id); });
      el.addEventListener("dragend", () => { dragging = null; el.classList.remove("is-drag"); clearMarker(); if (dirty) { dirty = false; draw(); } });
    }
    return el;
  }

  // ---- 글 아래 댓글(보드 설정 "댓글을 글 아래에 바로 보여요") ----
  const SHOW_COMMENTS = 3;
  const drafts = new Map();   // 쓰던 댓글: 화면을 다시 그려도 남게(글 id → 글자)
  const inlineComments = () => data.board.allow_comments && data.board.comments_inline !== false;
  function commentsBlock(p, big) {
    const list = p.comments.slice(-SHOW_COMMENTS);
    const more = p.comments.length - list.length;
    const input = h("input", { class: "ss-input mb-ccmts__input" + (big ? " ss-input--lg" : ""), maxlength: LIMITS.comment, placeholder: "댓글 쓰기",
      "aria-label": "댓글 쓰기", "data-ccmt": p.id, value: drafts.get(p.id) || "", oninput: (e) => drafts.set(p.id, e.target.value) });
    const send = h("button", { class: "ss-btn ss-btn--sm ss-btn--main", type: "submit", text: "쓰기" });
    return h("div", { class: "mb-ccmts" },
      more > 0 && h("button", { class: "mb-linkbtn mb-ccmts__more", type: "button", text: `댓글 ${p.comments.length}개 모두 보기`, onclick: (e) => { e.stopPropagation(); detail(p.id); } }),
      list.length > 0 && h("ul", { class: "mb-ccmts__list", "aria-label": "댓글" }, list.map((c) => h("li", { class: "mb-ccmt" + (c.by_teacher ? " is-teacher" : "") },
        h("b", { text: showName(c) || "친구" }), h("span", { text: c.body }),
        (teacher || c.mine) && h("button", { class: "mb-linkbtn", type: "button", text: "지우기", "aria-label": "이 댓글 지우기",
          onclick: (e) => { e.stopPropagation(); guard(api.deleteComment(p.id, c.id)); } })))),
      h("form", { class: "mb-ccmts__form", onsubmit: async (e) => {
        e.preventDefault(); e.stopPropagation();
        const t = input.value.trim(); if (!t) return;
        send.disabled = true;
        try { await api.addComment(p.id, t, { asTeacher: teacher, author: me.name }); drafts.delete(p.id); input.value = ""; }
        catch (err) { toast(err?.userMessage || "댓글을 쓰지 못했어요. 다시 해 주세요."); }
        send.disabled = false;
      } }, input, send));
  }

  function detail(id) {
    openPostDetail({ get: () => data.posts.find((x) => x.id === id), board: data.board, student: !teacher, showName,
      subscribe: (fn) => { afterLoad.add(fn); return () => afterLoad.delete(fn); },
      actions: {
        addComment: async (t) => { try { await api.addComment(id, t, { asTeacher: teacher, author: me.name }); } catch (e) { return e?.userMessage || "댓글을 쓰지 못했어요. 다시 해 주세요."; } },
        deleteComment: (cid) => guard(api.deleteComment(id, cid)),
        canDelete: (c) => teacher || c.mine,
      } });
  }

  // ---- 글 메뉴(고치기·옮기기·지우기) ----
  let menuEl = null;
  const closeMenu = () => { menuEl?.remove(); menuEl = null; };
  addEventListener("click", closeMenu);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  function postMenu(p, anchor) {
    closeMenu();
    const item = (label, fn, danger) => h("button", { type: "button", role: "menuitem", class: danger ? "is-danger" : "", text: label, onclick: (e) => { e.stopPropagation(); closeMenu(); fn(); } });
    menuEl = h("div", { class: "mb-menu", role: "menu" },
      item("고치기", () => compose({ post: p })),
      teacher && sections().length > 0 && item("다른 칸으로 옮기기", () => moveDialog(p)),
      item("지우기", () => removePost(p), true));
    anchor.after(menuEl);
    menuEl.querySelector("button")?.focus();
  }
  async function removePost(p) {
    const ok = await confirmBox({ title: "글을 지울까요?", text: "글과 댓글, 붙인 사진·파일이 함께 지워져요." });
    if (!ok) return;
    if (await guard(api.deletePost(p.id))) toast("글을 지웠어요");
  }
  function moveDialog(p) {
    const m = modal({ title: "다른 칸으로 옮기기", cls: "mb-dlg" });
    const sel = h("select", { class: "ss-select", id: "mb-mv-sec" }, sections().map((s) => h("option", { value: s.id, text: s.title })));
    sel.value = p.section_id || sections()[0].id;
    const where = h("select", { class: "ss-select", id: "mb-mv-pos" }, h("option", { value: "end", text: "맨 아래" }), h("option", { value: "start", text: "맨 위" }));
    m.body.append(h("p", { class: "mb-hint", text: "마우스로 글을 끌어서 옮길 수도 있어요." }),
      h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-mv-sec", text: "칸" }), sel),
      h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-mv-pos", text: "자리" }), where));
    m.foot.append(h("button", { class: "ss-btn", type: "button", text: "취소", onclick: () => m.close() }),
      h("button", { class: "ss-btn ss-btn--main", type: "button", text: "옮기기", onclick: async () => {
        const first = inSection(sel.value).find((x) => x.id !== p.id);
        await guard(api.movePost(p.id, sel.value, where.value === "start" ? first?.id : null)); m.close();
      } }));
    m.focus();
  }

  // ---- 글쓰기 ----
  function compose({ post = null, sectionId = null } = {}) {
    const b = data.board;
    openCompose({ post, sections: sections(), sectionId, allowFiles: teacher || b.allow_files, student: !teacher, upload: api.uploadFile,
      notice: !teacher && !post && b.needs_approval ? "선생님이 확인하면 친구들에게 보여요." : "",
      onSubmit: async (v) => {
        if (!teacher && !b.allow_post) return "지금은 글을 쓸 수 없어요.";
        try {
          if (post) await api.updatePost(post.id, v);
          else await api.createPost(boardId, v, { asTeacher: teacher, needsApproval: b.needs_approval, author: me.name });
        } catch (e) { return e?.userMessage || "붙이지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요."; }
        if (!post) toast(!teacher && b.needs_approval ? "붙였어요. 선생님이 확인하면 보여요" : "붙였어요");
        if (!teacher && v.section_id) stuSection = v.section_id;
      } });
  }

  // ---- 끌어 옮기기(교사, 칸·묶음 배치) ----
  let marker = null;
  const clearMarker = () => { marker?.remove(); marker = null; };
  function dropZone(list, sid) {
    list.addEventListener("dragover", (e) => {
      if (!dragging) return;
      e.preventDefault(); e.dataTransfer.dropEffect = "move";
      const before = cardBefore(list, e.clientX, e.clientY);
      marker ??= h("div", { class: "mb-dropmark", "aria-hidden": "true" });
      if (before) list.insertBefore(marker, before); else list.append(marker);
    });
    list.addEventListener("dragleave", (e) => { if (!list.contains(e.relatedTarget)) clearMarker(); });
    list.addEventListener("drop", async (e) => {
      e.preventDefault();
      const id = dragging, before = marker?.nextElementSibling?.dataset?.id || null;
      clearMarker();
      if (id) { dirty = false; await guard(api.movePost(id, sid, before === id ? null : before)); }
    });
  }
  /** 마우스 위치 바로 뒤에 오는 카드(읽는 순서: 위→아래, 같은 줄이면 왼→오) */
  function cardBefore(list, x, y) {
    const cards = [...list.querySelectorAll(":scope > .mb-card:not(.is-drag)")];
    const vertical = !!list.closest(".mb-col");
    return cards.find((c) => {
      const r = c.getBoundingClientRect();
      if (vertical) return y < r.top + r.height / 2;
      return y < r.top || (y <= r.bottom && x < r.left + r.width / 2);
    }) || null;
  }

  // ---- 칸 ----
  function sectionMenu(s, anchor) {
    closeMenu();
    const list = sections(), i = list.indexOf(s);
    const item = (label, fn, danger, disabled) => h("button", { type: "button", role: "menuitem", class: danger ? "is-danger" : "", disabled, text: label, onclick: (e) => { e.stopPropagation(); closeMenu(); fn(); } });
    const across = data.board.layout === "column";
    menuEl = h("div", { class: "mb-menu", role: "menu" },
      item("이름 바꾸기", () => nameDialog({ title: "칸 이름 바꾸기", value: s.title, ok: "바꾸기", onOk: (t) => guard(api.renameSection(s.id, t)) })),
      item(across ? "왼쪽으로" : "위로", () => guard(api.moveSection(s.id, -1)), false, i === 0),
      item(across ? "오른쪽으로" : "아래로", () => guard(api.moveSection(s.id, 1)), false, i === list.length - 1),
      item("칸 지우기", async () => {
        const n = data.posts.filter((p) => p.section_id === s.id).length;
        const ok = await confirmBox({ title: "칸을 지울까요?", text: n ? `'${s.title}' 칸의 글 ${n}개는 지우지 않고 '칸 없음'으로 옮겨요.` : `'${s.title}' 칸을 지워요.` });
        if (ok) guard(api.deleteSection(s.id));
      }, true));
    anchor.after(menuEl);
    menuEl.querySelector("button")?.focus();
  }
  function nameDialog({ title, value = "", ok, onOk }) {
    const m = modal({ title, cls: "mb-dlg" });
    const err = h("div", { class: "ss-alert ss-alert--error", role: "alert", hidden: true });
    const input = h("input", { class: "ss-input", id: "mb-sec-name", maxlength: LIMITS.section, value, "data-autofocus": true });
    const go = async () => {
      const t = input.value.trim();
      if (!t) { err.textContent = "칸 이름을 적어 주세요."; err.hidden = false; return; }
      await onOk(t); m.close();
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    m.body.append(err, h("label", { class: "ss-label", for: "mb-sec-name", text: "칸 이름" }), input);
    m.foot.append(h("button", { class: "ss-btn", type: "button", text: "취소", onclick: () => m.close() }), h("button", { class: "ss-btn ss-btn--main", type: "button", text: ok, onclick: go }));
    m.focus(); input.select();
  }
  const addSectionBtn = () => teacher && sections().length < LIMITS.sections && h("button", { class: "mb-addsec", type: "button",
    onclick: () => nameDialog({ title: "칸 추가", value: `칸 ${sections().length + 1}`, ok: "추가", onOk: (t) => guard(api.addSection(boardId, t)) }) }, icon("plus"), h("span", { text: "칸 추가" }));

  function sectionBlock(s, cls) {
    const sid = s?.id ?? null;
    const list = h("div", { class: "mb-list", "data-section": sid ?? "" }, inSection(sid).map((p) => card(p)));
    if (!list.children.length) list.append(h("p", { class: "mb-list__empty", text: query || onlyPending ? "찾는 글이 없어요" : "아직 글이 없어요" }));
    if (teacher) dropZone(list, sid);
    const canWrite = teacher || data.board.allow_post;
    return h("section", { class: cls, "aria-label": s ? s.title : "칸 없음" },
      h("header", { class: "mb-sec__head" },
        h("h2", { class: "mb-sec__title", text: s ? s.title : "칸 없음" }),
        h("span", { class: "mb-sec__count", text: String(inSection(sid).length) }),
        h("span", { class: "mb-card__sp" }),
        teacher && s && h("button", { class: "mb-iconbtn", type: "button", "aria-label": `${s.title} 칸 메뉴`, onclick: (e) => { e.stopPropagation(); sectionMenu(s, e.currentTarget); } }, icon("more"))),
      list,
      canWrite && s && h("button", { class: "mb-sec__add", type: "button", onclick: () => compose({ sectionId: sid }) }, icon("plus"), h("span", { text: "이 칸에 글 쓰기" })));
  }

  // ---- 그리기 ----
  function draw() {
    if (dragging) { dirty = true; return; }   // 끄는 중에는 다시 그리지 않아요(끝나면 그려요)
    const b = data.board;
    onTitle?.(b.title);
    applyLook(b);
    const all = data.posts.filter((p) => teacher || p.status === "visible" || p.mine);
    const pendingN = data.posts.filter((p) => p.status === "pending").length;

    const search = teacher && h("label", { class: "mb-search" }, icon("search"),
      h("input", { type: "search", class: "mb-search__input", placeholder: "글 찾기", "aria-label": "글 찾기", value: query,
        oninput: (e) => { query = e.target.value.trim().toLowerCase(); drawStage(); } }));
    fill(head,
      h("div", { class: "mb-head__text" },
        teacher && h("a", { class: "mb-back", href: "./", text: "‹ 보드 목록" }),
        h("h1", { class: "mb-title", text: b.title }),
        b.description && h("p", { class: "mb-desc", text: b.description }),
        h("p", { class: "mb-meta" }, teacher ? `글 ${all.filter((p) => p.status === "visible").length}개` : `${me.name || ""} 학생으로 들어왔어요`,
          !teacher && !b.allow_post && " · 지금은 보기만 할 수 있어요")),
      teacher && h("div", { class: "mb-head__tools" }, search,
        b.needs_approval || pendingN ? h("button", { class: "ss-pill mb-pill", type: "button", "aria-pressed": onlyPending ? "true" : "false",
          onclick: () => { onlyPending = !onlyPending; draw(); } }, `확인 기다림 ${pendingN}`) : null));

    const canWrite = teacher || b.allow_post;
    fab.replaceChildren(canWrite ? h("button", { class: teacher ? "mb-fab__btn" : "mb-fab__btn mb-fab__btn--stu", type: "button", onclick: () => compose({ sectionId: !teacher ? stuSection : null }) },
      icon("plus"), h("span", { text: "글 쓰기" })) : "");
    drawStage();
  }

  function drawStage() {
    const b = data.board;
    const keepX = stage.querySelector(".mb-cols")?.scrollLeft || 0;
    const secs = sections();
    const orphan = secs.length ? inSection(null) : [];
    const total = ordered().length;
    let content;

    if (!data.posts.some((p) => teacher || p.status === "visible" || p.mine) && !secs.length) {
      content = h("div", { class: "ss-empty mb-empty" },
        h("b", { text: "아직 글이 없어요" }),
        h("span", { text: teacher ? "학생 초대로 학생을 들여보내거나, 먼저 글을 하나 붙여 보세요." : b.allow_post ? "아래 '글 쓰기'를 눌러 첫 글을 붙여 보세요." : "선생님이 글을 붙이면 여기에 보여요." }));
    } else if (!teacher) {
      // 학생: 한 번에 칸 하나(칸이 있으면 위쪽 알약으로 고르기), 큰 카드 한 줄
      const opts = [...(orphan.length ? [{ id: null, title: "칸 없음" }] : []), ...secs];
      if (opts.length && !opts.some((s) => s.id === stuSection)) stuSection = opts[0].id;
      const list = opts.length ? inSection(stuSection) : ordered();
      content = h("div", { class: "mb-stu" },
        opts.length > 1 && h("div", { class: "mb-stu__tabs", role: "tablist", "aria-label": "칸" }, opts.map((s) =>
          h("button", { class: "mb-stu__tab", type: "button", role: "tab", "aria-selected": s.id === stuSection ? "true" : "false",
            onclick: () => { stuSection = s.id; drawStage(); } }, h("span", { text: s.title }), h("small", { text: String(inSection(s.id).length) })))),
        h("div", { class: "mb-stu__list" }, list.length ? list.slice().reverse().map((p) => card(p, { big: true }))
          : h("p", { class: "mb-list__empty", text: "이 칸에는 아직 글이 없어요" })));
    } else if (b.layout === "wall") {
      content = total ? h("div", { class: "mb-wall" }, ordered().map((p) => card(p)))
        : h("p", { class: "mb-list__empty", text: "찾는 글이 없어요" });
    } else {
      const blocks = [...(orphan.length ? [sectionBlock(null, b.layout === "column" ? "mb-col mb-col--none" : "mb-row mb-row--none")] : []),
        ...secs.map((s) => sectionBlock(s, b.layout === "column" ? "mb-col" : "mb-row"))];
      content = b.layout === "column"
        ? h("div", { class: "mb-cols" }, blocks, addSectionBtn())
        : h("div", { class: "mb-rows" }, blocks, addSectionBtn());
    }
    const act = document.activeElement?.dataset?.ccmt ? { id: document.activeElement.dataset.ccmt, at: document.activeElement.selectionStart } : null;
    stage.replaceChildren(content);
    if (act) { const i = stage.querySelector(`[data-ccmt="${act.id}"]`); if (i) { i.focus(); try { i.setSelectionRange(act.at, act.at); } catch { /* 무시 */ } } }
    const cols = stage.querySelector(".mb-cols");
    if (cols) {
      cols.scrollLeft = keepX;
      // 세로 휠로도 칸을 좌우로 넘겨요(칸 안 목록을 스크롤할 때는 그대로)
      cols.addEventListener("wheel", (e) => {
        if (e.target.closest(".mb-list") && e.target.closest(".mb-list").scrollHeight > e.target.closest(".mb-list").clientHeight) return;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { cols.scrollLeft += e.deltaY; e.preventDefault(); }
      }, { passive: false });
    }
  }

  // 실시간 반영(개발 시: 교사는 Supabase Realtime, 학생은 5초마다 다시 읽기)
  // 글 보기 창은 보드를 다시 읽은 뒤에 다시 그려요
  const afterLoad = new Set();
  api.subscribe(async () => { if (await load(true)) { root.replaceChildren(head, stage, fab); draw(); afterLoad.forEach((fn) => fn()); } });
  draw();
}
