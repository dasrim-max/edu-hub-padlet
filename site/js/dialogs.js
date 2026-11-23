// 팝업: 보드 만들기·설정, 글쓰기·고치기, 글 자세히 보기(댓글)
import { h, put, fill, modal, icon, LAYOUTS, LIMITS, EMOJIS, VIDEO_EXT, checkFile, fileExt, fileSize, timeAgo, confirmBox, toast, videoEl } from "./common.js";
import { BG_PRESETS, CARD_COLORS } from "./board-style.js";

// ---------------------------------------------------------------------------
// 보드 만들기 / 보드 설정
// ---------------------------------------------------------------------------
const PERMS = [
  ["allow_post", "학생이 글을 쓸 수 있어요", "끄면 학생은 보기만 해요"],
  ["needs_approval", "선생님이 확인한 글만 보여요", "학생 글은 선생님이 '보이기'를 눌러야 친구들에게 보여요"],
  ["allow_comments", "댓글", ""],
  ["comments_inline", "댓글을 글 아래에 바로 보여요", "끄면 댓글 수만 보이고, 눌러야 열려요"],
  ["allow_like", "좋아요", ""],
  ["allow_emoji", "이모지 반응", ""],
  ["allow_files", "사진·영상·파일 올리기", "사진 10MB, 영상 50MB, 파일 20MB까지"],
  ["show_names", "친구 이름 보이기", "끄면 학생 화면에는 이름 없이 보여요(선생님은 늘 보여요)"],
];
export const BOARD_DEFAULTS = { layout: "wall", needs_approval: false, allow_post: true, allow_comments: true,
  allow_like: true, allow_emoji: true, allow_files: true, show_names: true, comments_inline: true };

/**
 * onSave(values) 가 오류 문구를 돌려주면 창에 보여 줘요. onDelete 가 있으면 "보드 지우기" 버튼.
 * upload(file) 이 있으면 배경 사진을 고를 수 있어요(보드를 만든 뒤 설정에서). onPreview(look) 는 고르는 동안 화면에 미리 보여 주기,
 * onClose 는 창을 닫을 때(저장하지 않았으면 원래 꾸미기로 되돌리기).
 */
export function openBoardDialog({ board = null, onSave, onDelete, upload = null, onPreview = null, onClose = null }) {
  const v = { ...BOARD_DEFAULTS, ...(board || {}) };
  const m = modal({ title: board ? "보드 설정" : "새 보드 만들기", wide: true, cls: "mb-dlg", onClose });
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
  const syncPerm = () => {
    for (const k of ["needs_approval", "allow_files"]) perm[k].closest("label").classList.toggle("is-off", !perm.allow_post.checked);
    perm.comments_inline.closest("label").classList.toggle("is-off", !perm.allow_comments.checked);
  };
  perm.allow_post.addEventListener("change", syncPerm); perm.allow_comments.addEventListener("change", syncPerm); syncPerm();

  // ---- 꾸미기: 배경(기본 · 무늬 · 그라데이션 · 사진) + 카드 색 ----
  let photo = v.bg_image_path ? { path: v.bg_image_path, url: v.bg_image || null } : null;
  const startBg = v.bg_image_path ? "photo" : v.bg_preset || "";
  const bgOpt = (id, label, inner) => h("label", { class: "mb-swopt" },
    h("input", { type: "radio", name: "mb-bg", value: id, checked: id === startBg, "aria-label": label }),
    h("span", { class: "mb-bgsw", "data-bg": id === "photo" ? "" : id, "aria-hidden": "true" }, inner), h("span", { text: label }));
  const photoSw = () => photo?.url ? h("img", { src: photo.url, alt: "" }) : icon("image");
  const photoOpt = upload && bgOpt("photo", photo ? "사진" : "사진 고르기", photoSw());
  const pickPhoto = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", hidden: true });
  const bgErr = h("p", { class: "ss-alert ss-alert--error", role: "alert", hidden: true });
  photoOpt?.addEventListener("click", (e) => { if (!photo) { e.preventDefault(); pickPhoto.click(); } });
  pickPhoto.addEventListener("change", async () => {
    const f = pickPhoto.files?.[0]; pickPhoto.value = "";
    if (!f) return;
    const bad = checkFile(f, "image");
    if (bad) { bgErr.textContent = bad; bgErr.hidden = false; return; }
    bgErr.hidden = true;
    const sw = photoOpt.querySelector(".mb-bgsw");
    sw.replaceChildren(h("small", { text: "올리는 중…" }));
    try {
      const up = await upload(await shrinkImage(f));
      photo = { path: up.path, url: up.url };
      sw.replaceChildren(photoSw()); photoOpt.lastChild.textContent = "사진";
      photoOpt.querySelector("input").checked = true; preview();
    } catch (e) { sw.replaceChildren(photoSw()); bgErr.textContent = e?.userMessage || "사진을 올리지 못했어요. 다시 골라 주세요."; bgErr.hidden = false; }
  });
  const looks = h("div", { class: "mb-looks" },
    h("div", { class: "mb-swatches", role: "radiogroup", "aria-label": "배경" },
      bgOpt("", "기본"), photoOpt,
      BG_PRESETS.filter((p) => p.group === "pattern").map((p) => bgOpt(p.id, p.label)),
      BG_PRESETS.filter((p) => p.group === "gradient").map((p) => bgOpt(p.id, p.label))),
    pickPhoto, bgErr,
    upload && h("button", { class: "ss-btn ss-btn--ghost ss-btn--sm mb-looks__photo", type: "button", onclick: () => pickPhoto.click() }, icon("image"), " 배경 사진 올리기"),
    !upload && h("p", { class: "mb-hint", text: "배경 사진은 보드를 만든 뒤 보드 설정에서 고를 수 있어요." }),
    h("span", { class: "mb-looks__group", text: "카드 색" }),
    h("div", { class: "mb-swatches mb-swatches--cards", role: "radiogroup", "aria-label": "카드 색" },
      [{ id: "", label: "기본" }, ...CARD_COLORS].map((c) => h("label", { class: "mb-swopt" },
        h("input", { type: "radio", name: "mb-card", value: c.id, checked: c.id === (v.card_color || ""), "aria-label": `카드 ${c.label}` }),
        h("span", { class: "mb-cardsw", "data-card": c.id || null, "aria-hidden": "true", text: "가" }), h("span", { text: c.label })))));
  const look = () => {
    const bg = m.body.querySelector('input[name="mb-bg"]:checked')?.value ?? "";
    const card = m.body.querySelector('input[name="mb-card"]:checked')?.value ?? "";
    return { bg_preset: bg && bg !== "photo" ? bg : null, bg_image_path: bg === "photo" ? photo?.path ?? null : null,
      bg_image: bg === "photo" ? photo?.url ?? null : null, card_color: card || null };
  };
  const preview = () => onPreview?.(look());
  looks.addEventListener("change", (e) => { if (e.target.name === "mb-bg" || e.target.name === "mb-card") preview(); });

  put(m.body, err,
    h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-b-title", text: "보드 이름" }), title),
    h("div", { class: "mb-field" }, h("label", { class: "ss-label", for: "mb-b-desc", text: "안내" }), desc),
    h("fieldset", { class: "mb-field" }, h("legend", { class: "ss-label", text: "배치" }), layoutPick),
    h("fieldset", { class: "mb-field" }, h("legend", { class: "ss-label", text: "꾸미기" }), looks),
    h("fieldset", { class: "mb-field" }, h("legend", { class: "ss-label", text: "학생이 할 수 있는 것" }), permList));

  const save = h("button", { class: "ss-btn ss-btn--main", type: "button", text: board ? "저장" : "만들기" });
  save.onclick = async () => {
    const t = title.value.trim();
    if (!t) { err.textContent = "보드 이름을 적어 주세요."; err.hidden = false; title.focus(); return; }
    const values = { title: t, description: desc.value.trim(),
      layout: m.body.querySelector('input[name="mb-layout"]:checked').value,
      ...Object.fromEntries(PERMS.map(([k]) => [k, perm[k].checked])), ...look() };
    if (m.body.querySelector('input[name="mb-bg"]:checked')?.value === "photo" && !values.bg_image_path) {
      err.textContent = "배경 사진을 골라 주세요."; err.hidden = false; return;
    }
    delete values.bg_image;   // 보여 주기용 주소는 저장하지 않아요
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

  // 사진·영상·파일 (각각 하나)
  let image = post?.image ? { url: post.image, path: post.image_path ?? null } : null, file = post?.file || null, video = post?.video || null, busy = false;
  const attach = h("div", { class: "mb-attach" });
  const pickImg = h("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp", hidden: true });
  const pickFile = h("input", { type: "file", hidden: true });
  const pickVideo = h("input", { type: "file", accept: "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v", hidden: true });
  const drawAttach = () => fill(attach,
    image && h("div", { class: "mb-attach__item" }, h("img", { src: image.url, alt: "올릴 사진 미리보기" }),
      h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "사진 빼기", onclick: () => { image = null; drawAttach(); } })),
    video && h("div", { class: "mb-attach__item mb-attach__item--video" }, videoEl(video, { cls: "mb-attach__video", label: "올릴 영상 미리보기" }),
      h("span", { text: `${video.name || "영상"} · ${fileSize(video.size || 0)}` }),
      h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "영상 빼기", onclick: () => { video = null; drawAttach(); } })),
    file && h("div", { class: "mb-attach__item mb-attach__item--file" }, icon("clip"), h("span", { text: `${file.name} · ${fileSize(file.size)}` }),
      h("button", { class: "ss-btn ss-btn--sm", type: "button", text: "파일 빼기", onclick: () => { file = null; drawAttach(); } })));
  const onPick = (pickKind) => async (e) => {
    let kind = pickKind;
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (kind === "file" && VIDEO_EXT.includes(fileExt(f.name))) kind = "video";   // "파일"로 영상을 골라도 영상으로
    const bad = checkFile(f, kind);
    if (bad) return say(bad);
    say(""); busy = true; send.disabled = true; send.textContent = kind === "video" ? "영상 올리는 중…" : "올리는 중…";
    try {
      const up = await upload(f, kind);
      if (kind === "image") image = { url: up.url, path: up.path };
      else if (kind === "video") video = { name: up.name, size: up.size, url: up.url, path: up.path };
      else file = { name: up.name, size: up.size, url: up.url, path: up.path };
      drawAttach();
    } catch (e) { say(e?.userMessage || "올리지 못했어요. 인터넷 연결을 확인하고 다시 골라 주세요."); }
    busy = false; send.disabled = false; send.textContent = post ? "고치기" : "붙이기";
  };
  pickImg.addEventListener("change", onPick("image"));
  pickFile.addEventListener("change", onPick("file"));
  pickVideo.addEventListener("change", onPick("video"));
  drawAttach();
  const tools = allowFiles && h("div", { class: "mb-tools" },
    h("button", { class: "ss-btn ss-btn--ghost" + (student ? " ss-btn--lg" : ""), type: "button", onclick: () => pickImg.click() }, icon("image"), " 사진"),
    h("button", { class: "ss-btn ss-btn--ghost" + (student ? " ss-btn--lg" : ""), type: "button", onclick: () => pickVideo.click() }, icon("video"), " 영상"),
    h("button", { class: "ss-btn ss-btn--ghost" + (student ? " ss-btn--lg" : ""), type: "button", onclick: () => pickFile.click() }, icon("clip"), " 파일"),
    pickImg, pickVideo, pickFile);

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
      image: image?.url || null, image_path: image?.path ?? null, file, video };
    if (!v.title && !v.body && !v.image && !v.file && !v.video) { say("제목이나 내용을 적어 주세요."); body.focus(); return; }
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
      p.video && videoEl(p.video, { cls: "mb-detail__video" }),
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

/** 큰 사진은 긴 쪽 1920px 로 줄여 JPG 로(원본 학급패들렛과 같음). 줄일 수 없으면 원본 그대로 */
export async function shrinkImage(file, max = 1920, quality = 0.85) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", quality));
    return blob ? new File([blob], "background.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
