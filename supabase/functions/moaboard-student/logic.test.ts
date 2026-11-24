// 실행: node --experimental-strip-types --test supabase/functions/moaboard-student/logic.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { checkPost, fileKey, isHubPath, ownFile, ownPath, shapeBoard, IMAGE_EXT, VIDEO_EXT, type Board, type PostRow } from "./logic.ts";

const T = "11111111-1111-4111-8111-111111111111", B = "b0000000-0000-4000-8000-00000000000a";
const ME = "aaaaaaaa-0000-4000-8000-000000000001", YOU = "aaaaaaaa-0000-4000-8000-000000000002";
const R = "cccccccc-0000-4000-8000-000000000009";
const own = { teacherId: T, boardId: B, studentId: ME };

test("내 폴더의 파일 경로만 받는다", () => {
  assert.equal(ownPath(`${T}/${B}/${ME}/${R}.png`, own, IMAGE_EXT), true);
  assert.equal(ownPath(`${T}/${B}/${YOU}/${R}.png`, own, IMAGE_EXT), false, "다른 학생 폴더");
  assert.equal(ownPath(`${T}/${B}/t/${R}.png`, own, IMAGE_EXT), false, "교사 폴더");
  assert.equal(ownPath(`${T}/${B}/${ME}/${R}.exe`, own, IMAGE_EXT), false, "확장자");
  assert.equal(ownPath(`../${T}/${B}/${ME}/${R}.png`, own, IMAGE_EXT), false, "경로 장난");
});

test("글 검사: 빈 글·긴 글·파일 끈 보드", () => {
  assert.equal((checkPost({ title: " ", body: "" }, own, true) as { error: string }).error, "empty");
  assert.equal((checkPost({ body: "가".repeat(1001) }, own, true) as { error: string }).error, "bad_body");
  assert.equal((checkPost({ body: "a", image_path: `${T}/${B}/${ME}/${R}.png` }, own, false) as { error: string }).error, "no_files");
  const ok = checkPost({ title: " 제목 ", body: "내용\r\n둘째 줄", section_id: "x" }, own, true);
  assert.ok("v" in ok);
  if ("v" in ok) { assert.equal(ok.v.title, "제목"); assert.equal(ok.v.body, "내용\n둘째 줄"); assert.equal(ok.v.section_id, null); }
  const f = checkPost({ file: { path: `${T}/${B}/${ME}/${R}.pdf`, name: "../보고서.pdf", size: 1234 } }, own, true);
  assert.ok("v" in f && f.v.file_name === ".._보고서.pdf" && f.v.file_size === 1234);
});

test("영상: 종류·크기 검사, 내 폴더 경로만, 영상만 있는 글도 됨", () => {
  const ok = checkPost({ video: { path: `${T}/${B}/${ME}/${R}.mp4`, name: "발표.mp4", size: 1234 } }, own, true);
  assert.ok("v" in ok && ok.v.video_path === `${T}/${B}/${ME}/${R}.mp4` && ok.v.video_name === "발표.mp4" && ok.v.video_size === 1234);
  assert.equal((checkPost({ video: { path: `${T}/${B}/${YOU}/${R}.mp4` } }, own, true) as { error: string }).error, "bad_file", "다른 학생 영상");
  assert.equal((checkPost({ video: { path: `${T}/${B}/${ME}/${R}.mp4` } }, own, false) as { error: string }).error, "no_files");
  const out = shapeBoard(board(), [], [row({ id: "v", video_path: `${T}/${B}/${YOU}/${R}.mp4`, video_name: "v.mp4", video_size: 9 })], ME, new Map([[`${T}/${B}/${YOU}/${R}.mp4`, "https://signed/v"]]));
  assert.deepEqual(out.posts[0].video, { name: "v.mp4", size: 9, url: "https://signed/v", key: R, path: null }, "경로 전체는 다른 학생에게 보내지 않음");
});

test("새 경로(공통 파일 모듈): 이 학생·이 보드·이 교사 것만, 종류에 맞는 확장자만", () => {
  const hub = (who: string, board = B, teacher = T, ext = "png") => `moaboard/${teacher}/${board}/${who}/${R}.${ext}`;
  assert.equal(isHubPath(hub(ME)), true);
  assert.equal(isHubPath(`${T}/${B}/${ME}/${R}.png`), false, "예전 경로");
  assert.equal(ownFile(hub(ME), own, IMAGE_EXT), true);
  assert.equal(ownFile(hub(YOU), own, IMAGE_EXT), false, "다른 학생");
  assert.equal(ownFile(hub("t"), own, IMAGE_EXT), false, "교사 파일");
  assert.equal(ownFile(hub(ME, "b0000000-0000-4000-8000-00000000000b"), own, IMAGE_EXT), false, "다른 보드");
  assert.equal(ownFile(hub(ME, B, "22222222-2222-4222-8222-222222222222"), own, IMAGE_EXT), false, "다른 교사");
  assert.equal(ownFile(hub(ME, B, T, "mp4"), own, IMAGE_EXT), false, "사진 칸에 영상");
  assert.equal(ownFile(hub(ME, B, T, "mp4"), own, VIDEO_EXT), true);
  assert.equal(ownFile(`moaboard/${T}/${B}/${ME}/../${R}.png`, own, IMAGE_EXT), false, "../");
  assert.equal(ownFile(`quiz/${T}/${B}/${ME}/${R}.png`, own, IMAGE_EXT), false, "다른 앱");
  assert.equal(ownFile(`${T}/${B}/${ME}/${R}.png`, own, IMAGE_EXT), true, "예전 경로도 전환 기간에는 받음");
  assert.equal(fileKey(hub(ME)), R);
  assert.equal(fileKey(null), null);
});

const board = (o: Partial<Board> = {}): Board => ({ id: B, title: "보드", description: "", layout: "column", needs_approval: true, allow_post: true,
  allow_comments: true, allow_like: true, allow_emoji: false, allow_files: true, show_names: false, updated_at: "2026-11-21T00:00:00Z", ...o });
const row = (o: Partial<PostRow>): PostRow => ({ id: "p", board_id: B, section_id: null, position: 0, student_id: YOU, by_teacher: false, author_name: "친구",
  title: "", body: "글", image_path: null, file_path: null, file_name: null, file_size: null, status: "visible", created_at: "2026-11-21T00:00:00Z", ...o });

test("학생에게 보낼 보드: 확인 전 글은 내 것만, 이름 숨기기, 꺼진 반응 빼기", () => {
  const rows = [
    row({ id: "a", status: "pending" }),                                  // 친구의 확인 전 글: 안 보임
    row({ id: "b", status: "pending", student_id: ME, author_name: "나학생" }), // 내 확인 전 글: 보임
    row({ id: "c", moaboard_reactions: [{ actor_id: ME, kind: "like" }, { actor_id: YOU, kind: "👍" }],
      moaboard_comments: [{ id: "x", student_id: YOU, by_teacher: false, author_name: "친구", body: "댓글", created_at: "2026-11-21T00:00:01Z" }] }),
    row({ id: "d", by_teacher: true, student_id: null, author_name: "선생님" }),
  ];
  const out = shapeBoard(board(), [{ id: "s2", title: "둘", position: 1 }, { id: "s1", title: "하나", position: 0 }], rows, ME, new Map());
  assert.deepEqual(out.posts.map((p) => p.id), ["b", "c", "d"]);
  const [b, c, d] = out.posts;
  assert.equal(b.author, "나학생"); assert.equal(b.mine, true);
  assert.equal(c.author, "", "친구 이름 숨김"); assert.equal(c.comments[0].author, "");
  assert.equal(d.author, "선생님");
  assert.equal(c.likes, 1); assert.equal(c.liked, true);
  assert.deepEqual(c.emojis, {}, "이모지 반응이 꺼진 보드");
  assert.deepEqual(out.sections.map((s) => s.id), ["s1", "s2"]);
  assert.equal(c.image_path, null, "친구 파일 경로는 보내지 않음");
});

test("보드 꾸미기: 무늬·카드 색 이름과 배경 사진 주소를 보내고, 경로는 보내지 않는다", () => {
  const bgPath = `${T}/${B}/t/${R}.jpg`;
  const out = shapeBoard(board({ bg_preset: "cream-dots", card_color: "pink", bg_image_path: bgPath }), [], [], ME, new Map([[bgPath, "https://signed/bg"]]));
  assert.equal(out.board.bg_preset, "cream-dots");
  assert.equal(out.board.card_color, "pink");
  assert.equal(out.board.bg_image, "https://signed/bg");
  assert.equal("bg_image_path" in out.board, false);
  assert.equal(out.board.comments_inline, true, "값이 없으면 켜짐");
  assert.equal(shapeBoard(board({ comments_inline: false }), [], [], ME, new Map()).board.comments_inline, false);
});

test("담벼락이면 칸을 보내지 않고, 이름 보이기면 친구 이름이 보인다", () => {
  const out = shapeBoard(board({ layout: "wall", show_names: true }), [{ id: "s1", title: "하나", position: 0 }], [row({ id: "c" })], ME, new Map());
  assert.equal(out.sections.length, 0);
  assert.equal(out.posts[0].author, "친구");
});
