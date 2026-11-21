// 팝업: 보드 만들기·설정, 글쓰기·고치기, 글 자세히 보기(댓글)
import { h, put, fill, modal, icon, LAYOUTS, LIMITS, EMOJIS, checkFile, fileSize, timeAgo, confirmBox, toast } from "./common.js";

// ---------------------------------------------------------------------------
// 보드 만들기 / 보드 설정
// ---------------------------------------------------------------------------
const PERMS = [
  ["allow_post", "학생이 글을 쓸 수 있어요", "끄면 학생은 보기만 해요"],
  ["needs_approval", "선생님이 확인한 글만 보여요", "학생 글은 선생님이 '보이기'를 눌러야 친구들에게 보여요"],
  ["allow_comments", "댓글", ""],
  ["allow_like", "좋아요", ""],
  ["allow_emoji", "이모지 반응", ""],
  ["allow_files", "사진·파일 올리기", "사진 10MB, 파일 20MB까지"],
  ["show_names", "친구 이름 보이기", "끄면 학생 화면에는 이름 없이 보여요(선생님은 늘 보여요)"],
];
export const BOARD_DEFAULTS = { layout: "wall", needs_approval: false, allow_post: true, allow_comments: true,
  allow_like: true, allow_emoji: true, allow_files: true, show_names: true };

/** onSave(values) 가 오류 문구를 돌려주면 창에 보여 줘요. onDelete 가 있으면 "보드 지우기" 버튼 */
export function openBoardDialog({ board = null, onSave, onDelete }) {
  const v = { ...BOARD_DEFAULTS, ...(board || {}) };
  const m = modal({ title: board ? "보드 설정" : "새 보드 만들기", wide: true, cls: "mb-dlg" });
  const err = h("div", { class: "ss-alert ss-alert--error", role: "alert", hidden: true });
  const title = h("input", { class: "ss-input", id: "mb-b-title", maxlength: LIMITS.boardTitle, value: v.title || "", placeholder: "예: 우리 반 환경 캠페인", required: true, "data-autofocus": true });
  const desc = h("textarea", { class: "ss-input mb-textarea", id: "mb-b-desc", maxlength: LIMITS.boardDesc, rows: 2, placeholder: "학생에게 보일 안내 한 줄 (없어도 돼요)" });
  desc.value = v.description || "";

  const radioCards = (name, items, current, render) => h("div", { class: "mb-optcards", role: "radiogroup" },
    items.map(([val, label, sub]) => h("label", { class: "mb-optcard" },
      h("input", { type: "radio", name, value: val, checked: val === current }),
      h("span", { class: "mb-optcard__box" }, render(val), h("b", { text: label }), sub && h("small", { text: sub })))));

  const layoutPick = radioCards("mb-layout", LAYOUTS, v.layout, (val) =>
    h("span", { class: `mb-mini mb-mini--${val}`, "aria-hidden": "true" }, Array.from({ length: 6 }, () => h("i"))));

  const perm = Object.fromEntries(PERMS.map(([k]) => [k, h("input", { type: "checkbox", checked: !!v[k] })]));
  const permList = h("div", { class: "mb-perms" }, PERMS.map(([k, label, sub]) =>
    h("label", { class: "ss-check mb-perm" }, perm[k], h("span", {}, h("b", { text: label }), sub && h("small", { text: sub })))));
  // 글쓰기를 끄면 확인·파일 칸은 뜻이 없어서 흐리게
  const syncPerm = () => { for (const k of ["needs_approval", "allow_files"]) perm[k].closest("label").classList.toggle("is-off", !perm.allow_post.checked); };
  perm.allow_post.addEventListener("change", syncPerm); syncPerm();

  put(m.body, err,
    h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-b-title", text: "보드 이름" }), title),
    h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-b-desc", text: "안내" }), desc),
    h("fieldset", { class: "mb-field" }, h("legend", { class: "ss-label", text: "배치" }), layoutPick),
    h("fieldset", { class: "mb-field" }, h("legend", { class: "ss-label", text: "학생이 할 수 있는 것" }), permList));

  const save = h("button", { class: "ss-btn ss-btn--main", type: "button", text: board ? "저장" : "만들기" });
  save.onclick = async () => {
    const t = title.value.trim();
    if (!t) { err.textContent = "보드 이름을 적어 주세요."; err.hidden = false; title.focus(); return; }
    const values = { title: t, description: desc.value.trim(),
      layout: m.body.querySelector('input[name="mb-layout"]:checked').value,
      ...Object.fromEntries(PERMS.map(([k]) => [k, perm[k].checked])) };
    save.disabled = true; save.textContent = board ? "저장하는 중…" : "만드는 중…";
    const bad = await onSave(values);
    if (bad) { err.textContent = bad; err.hidden = false; save.disabled = false; save.textContent = board ? "저장" : "만들기"; return; }
    m.close();
  };
  if (onDelete) m.foot.append(h("button", { class: "ss-btn ss-btn--danger ss-modal__foot-start", type: "button", text: "보드 지우기", onclick: async () => {
    const ok = await confirmBox({ title: "보드를 지울까요?", text: `'${v.title}' 보드와 글·댓글·파일이 모두 지워져요. 되돌릴 수 없어요.` });
    if (ok) { m.close(); onDelete(); }
  } }));
  m.foot.append(h("button", { class: "ss-btn", type: "button", text: "취소", onclick: () => m.close() }), save);
  m.focus();
  return m;
}

// ---------------------------------------------------------------------------
// 글쓰기 / 고치기 (교사는 팝업, 학생은 화면 전체를 덮는 한 장)
// ---------------------------------------------------------------------------
/**
 * @param o.post       고칠 글(없으면 새 글)
 * @param o.sections   칸 목록(담벼락이면 빈 배열)
 * @param o.sectionId  처음 고를 칸
 * @param o.allowFiles 사진·파일 올리기
 * @param o.student    학생 화면(큰 글자·한 화면)
 * @param o.notice     위에 보일 안내(예: 선생님 확인 후 보여요)
 * @param o.onSubmit(values) 오류 문구를 돌려주면 보여 줘요
 */
export function openCompose({ post = null, sections = [], sectionId = null, allowFiles = true, student = false, notice = "", upload, onSubmit }) {
  const m = modal({ title: post ? "글 고치기" : "글 쓰기", cls: student ? "mb-dlg mb-sheet" : "mb-dlg" });
  const err = h("div", { class: "ss-alert ss-alert--error", role: "alert", hidden: true });
  const say = (t) => { err.textContent = t; err.hidden = !t; };
  const title = h("input", { class: "ss-input" + (student ? " ss-input--lg" : ""), id: "mb-p-title", maxlength: LIMITS.title, placeholder: "제목 (없어도 돼요)", value: post?.title || "" });
  const body = h("textarea", { class: "ss-input mb-textarea" + (student ? " ss-input--lg" : ""), id: "mb-p-body", maxlength: LIMITS.body, rows: student ? 5 : 6, placeholder: "생각을 적어 주세요", "data-autofocus": true });
  body.value = post?.body || "";
  const count = h("small", { class: "mb-count", "aria-live": "polite" });
  const upd = () => (count.textContent = `${body.value.length} / ${LIMITS.body}`);
  body.addEventListener("input", upd); upd();

  let sec = null;
  if (sections.length) {
    sec = h("select", { class: "ss-select" + (student ? " ss-select--lg" : ""), id: "mb-p-sec" },
      sections.map((s) => h("option", { value: s.id, text: s.title })));
    sec.value = post?.section_id ?? sectionId ?? sections[0].id;
  }

  // 사진·파일 (각각 하나)
  let image = post?.image ? { url: post.image } : null, file = post?.file || null, busy = false;
  const attach = h("div", { class: "mb-attach" });
  const pickImg = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", hidden: true });
  const pickFile = h("input", { type: "file", hidden: true });
  const drawAttach = () => fill(attach,
    image && h("div", { class: "mb-attach__item" }, h("img", { src: image.url, alt: "올릴 사진 미리보기" }),
      h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "사진 빼기", onclick: () => { image = null; drawAttach(); } })),
    file && h("div", { class: "mb-attach__item mb-attach__item--file" }, icon("clip"), h("span", { text: `${file.name} · ${fileSize(file.size)}` }),
      h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "파일 빼기", onclick: () => { file = null; drawAttach(); } })));
  const onPick = (kind) => async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const bad = checkFile(f, kind);
    if (bad) return say(bad);
    say(""); busy = true; send.disabled = true; send.textContent = "올리는 중…";
    try {
      const up = await upload(f);
      if (kind === "image") image = { url: up.url }; else file = { name: up.name, size: up.size, url: up.url };
      drawAttach();
    } catch { say("올리지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요."); }
    busy = false; send.disabled = false; send.textContent = post ? "고치기" : "붙이기";
  };
  pickImg.addEventListener("change", onPick("image"));
  pickFile.addEventListener("change", onPick("file"));
  drawAttach();
  const tools = allowFiles && h("div", { class: "mb-tools" },
    h("button", { class: "ss-btn ss-btn--ghost" + (student ? " ss-btn--lg" : ""), type: "button", onclick: () => pickImg.click() }, icon("image"), " 사진"),
    h("button", { class: "ss-btn ss-btn--ghost" + (student ? " ss-btn--lg" : ""), type: "button", onclick: () => pickFile.click() }, icon("clip"), " 파일"),
    pickImg, pickFile);

  put(m.body, err,
    notice && h("div", { class: "ss-alert ss-alert--warn", text: notice }),
    sec && h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-p-sec", text: "칸" }), sec),
    h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-p-title", text: "제목" }), title),
    h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-p-body", text: "내용" }), body, count),
    tools, attach);

  const send = h("button", { class: "ss-btn ss-btn--main" + (student ? " ss-btn--lg" : ""), type: "button", text: post ? "고치기" : "붙이기" });
  send.onclick = async () => {
    if (busy) return;
    const v = { title: title.value.trim(), body: body.value.trim(), section_id: sec ? sec.value : (post?.section_id ?? sectionId ?? null),
      image: image?.url || null, file };
    if (!v.title && !v.body && !v.image && !v.file) { say("제목이나 내용을 적어 주세요."); body.focus(); return; }
    send.disabled = true; send.textContent = "붙이는 중…";
    const bad = await onSubmit(v);
    if (bad) { say(bad); send.disabled = false; send.textContent = post ? "고치기" : "붙이기"; return; }
    m.close();
  };
  m.foot.append(h("button", { class: "ss-btn" + (student ? " ss-btn--lg" : ""), type: "button", text: "취소", onclick: () => m.close() }), send);
  m.focus();
  return m;
}

// ---------------------------------------------------------------------------
// 글 자세히 보기 + 댓글
// ---------------------------------------------------------------------------
/** get() 은 지금 글(실시간으로 바뀌면 다시 그려요). actions: { addComment, deleteComment, canDelete(c) } */
export function openPostDetail({ get, board, student = false, showName, actions, subscribe }) {
  let off = null;
  const m = modal({ title: "글 보기", wide: !student, cls: student ? "mb-dlg mb-sheet" : "mb-dlg", onClose: () => off?.() });
  const view = h("div", { class: "mb-detail" });
  const list = h("ul", { class: "mb-comments", "aria-label": "댓글" });
  const err = h("div", { class: "ss-alert ss-alert--error", role: "alert", hidden: true });
  const input = h("input", { class: "ss-input" + (student ? " ss-input--lg" : ""), maxlength: LIMITS.comment, placeholder: "댓글 쓰기", "aria-label": "댓글" });
  const send = h("button", { class: "ss-btn ss-btn--main" + (student ? " ss-btn--lg" : ""), type: "submit", text: "쓰기" });
  const form = board.allow_comments && h("form", { class: "mb-cform", onsubmit: async (e) => {
    e.preventDefault();
    const t = input.value.trim(); if (!t) return;
    send.disabled = true;
    const bad = await actions.addComment(t);
    send.disabled = false;
    if (bad) { err.textContent = bad; err.hidden = false; return; }
    err.hidden = true; input.value = ""; input.focus();
  } }, input, send);

  function draw() {
    const p = get();
    if (!p) { m.close(); toast("글이 지워졌어요"); return; }
    fill(view,
      p.image && h("img", { class: "mb-detail__img", src: p.image, alt: p.title ? `${p.title} 사진` : "올린 사진" }),
      p.title && h("h3", { class: "mb-detail__title", text: p.title }),
      p.body && h("p", { class: "mb-detail__body", text: p.body }),
      p.file && fileChip(p.file),
      h("p", { class: "mb-detail__meta", text: [showName(p), timeAgo(p.created_at)].filter(Boolean).join(" · ") }));
    if (board.allow_comments) {
      list.replaceChildren(...(p.comments.length ? p.comments.map((c) => h("li", { class: "mb-comment" + (c.by_teacher ? " is-teacher" : "") },
        h("b", { text: showName(c) || "친구" }), h("span", { text: c.body }), h("small", { text: timeAgo(c.created_at) }),
        actions.canDelete(c) && h("button", { class: "mb-linkbtn", type: "button", text: "지우기", "aria-label": "이 댓글 지우기", onclick: () => actions.deleteComment(c.id) })))
        : [h("li", { class: "mb-comment mb-comment--empty", text: "아직 댓글이 없어요. 첫 댓글을 남겨 보세요." })]));
    }
  }
  put(m.body, view, board.allow_comments && h("h3", { class: "mb-sub", text: "댓글" }), board.allow_comments && list, err, form);
  m.foot.append(h("button", { class: "ss-btn" + (student ? " ss-btn--lg" : ""), type: "button", text: "닫기", onclick: () => m.close() }));
  draw();
  off = subscribe(draw);
  return m;
}

export function fileChip(f) {
  return h("a", { class: "mb-file", href: f.url || "#", download: f.name, rel: "noopener", "aria-label": `${f.name} 내려받기` },
    icon("clip"), h("span", { class: "mb-file__name", text: f.name }), h("small", { text: fileSize(f.size) }));
}

/** 반응 줄: 좋아요 + 이모지. 누르면 켜고 끄기 */
export function reactionBar(p, board, { onLike, onEmoji, big = false }) {
  if (!board.allow_like && !board.allow_emoji) return null;
  const btn = (cls, pressed, label, kids, onclick) => h("button", { class: `mb-react ${cls}`, type: "button", "aria-pressed": pressed ? "true" : "false", "aria-label": label, onclick }, kids);
  const used = Object.entries(p.emojis || {}).filter(([, n]) => n > 0);
  let pop = null;
  const add = board.allow_emoji && h("span", { class: "mb-emoji-add" },
    h("button", { class: "mb-react mb-react--add", type: "button", "aria-label": "이모지 반응 고르기", "aria-expanded": "false", onclick: (e) => {
      e.stopPropagation();
      const b = e.currentTarget;
      if (pop) { pop.remove(); pop = null; b.setAttribute("aria-expanded", "false"); return; }
      b.setAttribute("aria-expanded", "true");
      pop = h("span", { class: "mb-emoji-pop", role: "group", "aria-label": "이모지" }, EMOJIS.map((em) =>
        h("button", { type: "button", text: em, "aria-pressed": p.my_emojis?.includes(em) ? "true" : "false", onclick: (ev) => { ev.stopPropagation(); onEmoji(em); } })));
      b.after(pop);
    } }, icon("smile")));
  return h("div", { class: "mb-reacts" + (big ? " mb-reacts--big" : "") },
    board.allow_like && btn("mb-react--like", p.liked, `좋아요 ${p.likes}개`, [icon("heart"), h("span", { text: String(p.likes || 0) })], (e) => { e.stopPropagation(); onLike(); }),
    board.allow_emoji && used.map(([em, n]) => btn("", p.my_emojis?.includes(em), `${em} ${n}개`, [h("span", { text: em }), h("span", { text: String(n) })], (e) => { e.stopPropagation(); onEmoji(em); })),
    add);
}
