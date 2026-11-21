# 모아보드 (edu-hub-padlet)

쌤허브 앱: 학생들의 생각(글·사진·파일)을 한 보드에 모으는 패들렛 방식 게시판.
학급패들렛 v1.0(React, 2026-06)의 기능을 쌤허브 구조(바닐라 JS + 공통 모듈 + 쌤허브 디자인 v1.0)로 옮겨 다시 만듭니다.

- 앱 slug: `moaboard` · 사이트 경로: `/moaboard/` · DB 표: `moaboard_*`
- 지금 단계: **화면 시안**(예시 데이터, 서버 연결 없음). 확인 뒤 데이터를 연결합니다.

## 시안 보기

포털 저장소(edu-hub)의 `packages/shared` 가 `/shared` 로, 이 저장소의 `site` 가 `/moaboard` 로 보이게 띄우면 됩니다.

```bash
mkdir -p /tmp/www && cd /tmp/www
ln -s <edu-hub>/packages/shared shared
ln -s <edu-hub-padlet>/site moaboard
python3 -m http.server 8765      # → http://localhost:8765/moaboard/
```

맨 위 "시안 확인용" 줄에서 화면(보드 목록·칸·담벼락·묶음·학생)과 상태(빈 목록·불러오는 중·오류)를 고를 수 있습니다.
시안에서 바꾼 내용은 이 탭에만 남습니다(`?reset=1` 이면 처음 예시로).

## 폴더

```
site/                    사이트로 내보내는 폴더 (apps.external.json 의 "site")
  index.html             교사(보드 목록 · 보드) / 학생(?as=student&c=…) 한 화면
  css/moaboard.css       앱 화면 CSS (앱 스타일 변수 --as-* 만 사용)
  css/demo.css           시안 확인용 — 배포 전에 지움
  js/main.js             입구: 주소로 화면 고르기 (개발 시 initHub / initStudent 연결 자리 표시)
  js/list.js             교사 첫 화면: 내 보드 목록, 새 보드
  js/board.js            보드 화면(교사·학생 공통): 배치 3가지, 글 카드, 확인, 끌어 옮기기, 칸 관리
  js/dialogs.js          보드 만들기·설정, 글쓰기·고치기, 글 보기(댓글), 반응
  js/slideshow.js        슬라이드쇼
  js/common.js           공통 도구(아이콘, 팝업 틀, 제한 값, 파일 검사)
  js/api-demo.js         시안 확인용 저장소 — 개발 시 api-teacher.js / api-student.js 로 바꿈
  demo/                  시안 확인용 그림 — 배포 전에 지움
```

## 화면 · 기능 (학급패들렛 → 모아보드)

| 학급패들렛 v1.0 | 모아보드 | 비고 |
|---|---|---|
| 교사 로그인·학교·학급·학생 등록·QR 발급 | 쌤허브 공통 기능 사용 | 로그인·교사 인증·학생 명단·학생 초대(QR·참여 코드)·자동 로그아웃 |
| 패들렛 목록·검색·생성 | 내 보드 목록 + 찾기 + 새 보드 | `?mode=new` 이면 바로 새 보드 |
| 공개 범위(학급/학년/전체), 대상별 권한 | 보드 하나 = 학생 초대 링크 하나, 권한 한 벌 | 쌤허브는 교사별 학생 명단이라 학년·학교 공개는 없음 |
| 배경색·카드색·배경 무늬 | 꾸미기 = 앱 스타일 B1~B6 중 고르기 | 디자인 규칙상 새 색을 만들지 않음. 비우면 관리자가 정한 스타일 |
| 담벼락 / 칸 / 격자 배치 | 담벼락 / 칸 / 묶음 | 칸 추가·이름 바꾸기·순서·지우기(글은 '칸 없음'으로) |
| 글(제목·내용·이미지·파일) | 같음 | 사진 10MB, 파일 20MB(pdf·hwp·hwpx·doc·docx·xls·xlsx·ppt·pptx·txt·zip) |
| 글 끌어 옮기기(dnd-kit) | 끌어 옮기기(브라우저 기본) + "다른 칸으로 옮기기" 메뉴 | 메뉴는 터치·키보드용 |
| 댓글·좋아요·이모지 | 같음(보드마다 켜고 끄기) | 이모지 👍 😊 😮 👏 🤔 |
| — | 선생님이 확인한 글만 보이기(보드마다) | 새 기능. 학생은 자기 글에 "선생님 확인 중" 표시 |
| — | 친구 이름 보이기 끄기 | 학생 화면에서만 이름을 숨김(교사는 늘 보임) |
| 실시간 반영 | 교사: Supabase Realtime / 학생: 5초마다 다시 읽기 | 학생은 DB 에 직접 접근하지 않음 |
| 슬라이드쇼(3/5/8/10초, ← → Space Esc) | 같음 + 전체 화면 | 검은 바탕(어두운 화면 색상 A 변수) |
| 현재 게시판 QR 띄우기 | 학생 초대(공통 팝업) | 앱 메뉴 "학생 초대" |

학생 화면: 글자 20px 이상, 누르는 곳 52px 이상. 칸이 있으면 위쪽 알약으로 칸을 하나 골라 그 칸 글만 보여 주고, 글쓰기·글 보기는 화면 전체를 덮는 한 장입니다.

## 데이터 연결 계획 (다음 단계)

표(초안, 모두 RLS 켜고 교사는 자기 것만, 학생은 서버 함수 `moaboard-student` 로만):

| 표 | 주요 칸 |
|---|---|
| `moaboard_boards` | id, teacher_id, title, description, layout(wall·column·grid), style(B1~B6·null), needs_approval, allow_post, allow_comments, allow_like, allow_emoji, allow_files, show_names, created_at, updated_at |
| `moaboard_sections` | id, board_id, title, position |
| `moaboard_posts` | id, board_id, section_id, position, student_id(null=교사), author_name, title, body, image_path, file_path, file_name, file_size, status(visible·pending), created_at, updated_at |
| `moaboard_comments` | id, post_id, student_id, author_name, body, created_at |
| `moaboard_reactions` | post_id, student_id 또는 teacher, kind(like·이모지), unique |

- 파일: 비공개 저장소 `moaboard-files`, 보여 줄 때 잠깐 쓰는 주소(signed URL). 학생 올리기는 서버 함수가 올릴 주소를 만들어 줌.
- 학생 함수 `moaboard-student`: `studentRequest(req, "moaboard")` 로 세션·참여 자격 확인 → list / post / edit / delete(내 글만) / comment / react / upload-url. 확인 전 글은 쓴 학생에게만, `show_names` 가 꺼져 있으면 이름을 빼고 보냄. 학생 한 명당 보드 하나에 글 30개 같은 한도.
- 교사: `initHub({ appSlug: "moaboard" })`, 보드를 만들거나 열 때 `recordActivity`, 지울 때 `removeActivity`, 학생 초대는 `openInvite`.
- `APP_ENTRY_ID` 로 들어온 학생(수업 흐름): 선생님이 가장 최근에 연 보드를 보여 줌(확정 필요).
- 포털 저장소: `apps.external.json` 에 `{ "slug": "moaboard", "repo": "dasrim-max/edu-hub-padlet", "ref": "main", "site": "site", "dest": "dist/moaboard" }`, `apps` 표 등록(내가 만든 활동 켬, 스타일 번호 B1 등).

## 배포 전에 지울 것

`site/css/demo.css`, `index.html` 의 `[data-demo]` 줄과 시안용 학생 초대 창(`#mb-invite`), `site/demo/`, `site/js/api-demo.js`.
