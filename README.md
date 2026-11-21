# 모아보드 (edu-hub-padlet)

쌤허브 앱: 학생들의 생각(글·사진·파일)을 한 보드에 모으는 패들렛 방식 게시판.
학급패들렛 v1.0(React, 2026-06)의 기능을 쌤허브 구조(바닐라 JS + 공통 모듈 + 쌤허브 디자인 v1.0)로 옮겨 다시 만들었습니다.

- 앱 slug: `moaboard` · 사이트 경로: `/moaboard/` · DB 표: `moaboard_*` · 학생 함수: `moaboard-student` · 파일 저장소: `moaboard-files`(비공개)
- 디자인: **애플 기본 스타일**(관리자 앱 등록 표의 스타일 번호를 비워 둠). 개성 있는 스타일은 나중에 정해서 스타일 번호만 넣으면 됩니다. 앱 CSS 는 `--as-*` 변수만 씁니다.

## 폴더

```
site/                         사이트로 내보내는 폴더 (포털의 apps.external.json "site")
  index.html                  교사(보드 목록 · 보드) / 학생(?as=student&c=…)
  css/moaboard.css            앱 화면 CSS
  js/main.js                  입구: initHub(교사) / initStudent(학생), 수업 흐름 "앱 전체"면 보드 고르기
  js/api-teacher.js           교사: Supabase(RLS) 읽기·쓰기, 실시간 반영, 파일 올리기
  js/api-student.js           학생: 서버 함수 moaboard-student 만 부름, 5초마다 다시 읽기
  js/list.js · board.js · dialogs.js · slideshow.js · common.js   화면
supabase/
  migrations/20261121090000_moaboard.sql    표·RLS·실시간·파일 저장소·앱 등록(꺼진 상태)
  functions/moaboard-student/               학생 함수(index.ts) + 순수 로직(logic.ts) + 시험(logic.test.ts)
  tests/moaboard_rls_test.sql               RLS 시험 22건(트랜잭션 안에서 실행 후 롤백)
preview/                      화면 시안(예시 데이터, 서버 연결 없음). 배포하지 않아요
.github/workflows/deploy.yml  main 에 올리면 학생 함수 배포 + 포털 사이트 다시 빌드
```

## 기능

| 학급패들렛 v1.0 | 모아보드 |
|---|---|
| 교사 로그인·학교·학급·학생 등록·QR | 쌤허브 공통 기능(로그인·교사 인증·학생 명단·학생 초대·자동 로그아웃) |
| 패들렛 목록·검색·생성 | 내 보드 목록 + 찾기 + 새 보드(`?mode=new`), "내가 만든 활동"에 기록 |
| 공개 범위·대상별 권한 | 보드 하나 = 학생 초대 링크 하나, 학생 권한 한 벌 |
| 배경·카드 색 | 애플 기본 스타일(나중에 스타일 번호로) |
| 담벼락 / 칸 / 격자 | 담벼락 / 칸 / 묶음, 칸 추가·이름·순서·지우기(글은 '칸 없음'으로) |
| 글(제목·내용·이미지·파일) | 같음. 사진 10MB, 파일 20MB(pdf·hwp·hwpx·doc·docx·xls·xlsx·ppt·pptx·txt·zip) |
| 끌어 옮기기 | 끌어 옮기기 + "다른 칸으로 옮기기" 메뉴(터치·키보드) |
| 댓글·좋아요·이모지 | 같음(보드마다 켜고 끄기) |
| — | 선생님이 확인한 글만 보이기(보드마다). 학생이 고친 글도 다시 확인 |
| — | 친구 이름 숨기기(학생 화면만, 서버가 이름을 빼고 보냄) |
| 실시간 반영 | 교사: Supabase Realtime(+30초마다 다시 읽기) / 학생: 5초마다 |
| 슬라이드쇼 | 3/5/8/10초, ← → Space Esc, 전체 화면 |

학생 한 명당 보드 하나에 글 30개, 댓글 100개까지. 학생 화면은 글자 20px·누르는 곳 52px 이상, 칸은 하나씩 골라 봅니다.
수업 흐름에 "앱 전체"(APP_ENTRY_ID)로 넣으면 학생은 선생님 보드 고르기 화면으로 들어옵니다(보드가 하나면 바로 그 보드).

## 시험

```bash
node --experimental-strip-types --test supabase/functions/moaboard-student/logic.test.ts   # 5건
# RLS: supabase/tests/moaboard_rls_test.sql 을 SQL Editor 에 붙여 넣기 → 마지막 표의 pass 가 모두 true (22건)
```

## 시안 보기(서버 없이)

포털 저장소의 `packages/shared` 를 `/shared` 로, 이 저장소를 `/moaboard` 로 띄우고 `/moaboard/preview/` 를 엽니다.

```bash
mkdir -p /tmp/www && cd /tmp/www && ln -s <edu-hub>/packages/shared shared && ln -s <edu-hub-padlet> moaboard
python3 -m http.server 8765      # → http://localhost:8765/moaboard/preview/
```

## 쌤허브에 연결하는 순서

1. 이 저장소의 작업 브랜치를 `main` 에 합친다(포털 빌드는 `main` 을 가져감).
2. 개발 DB 에 `supabase/migrations/20261121090000_moaboard.sql` 적용 → `supabase/tests/moaboard_rls_test.sql` 로 확인.
3. GitHub 비밀 값 `SUPABASE_ACCESS_TOKEN`, `PORTAL_READ_TOKEN`, `CF_PAGES_DEPLOY_HOOK` 등록 → Actions 의 deploy 실행(학생 함수 배포).
4. 포털 저장소의 `apps.external.json` 에 moaboard 줄이 있는지 확인(포털 작업 브랜치에 넣어 둠) → 포털 배포.
5. 관리자 화면에서 모아보드를 켠다(마이그레이션은 꺼진 상태로 등록, 스타일 번호는 비워 둠, 첫 화면 사진은 나중에).

**순서가 중요해요:** 1번(`main` 에 `site/index.html` 이 있음) 전에 포털 쪽 4번이 배포되면 포털 빌드가 실패합니다.
