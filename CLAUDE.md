# 모아보드(edu-hub-padlet) 작업 규칙

- 쌤허브 앱이다. 화면·디자인·공통 모듈 규칙은 포털 저장소(dasrim-max/edu-hub)의 `CLAUDE.md` 와 `packages/shared/ui/DESIGN.md` 를 따른다.
- 앱 기본 디자인은 애플 스타일(관리자 앱 등록 표의 스타일 번호 비움). 앱 CSS 는 `--as-*` 변수만 쓴다.
- 사이트로 나가는 것은 `site/` 뿐이다. `preview/` 는 예시 데이터 시안이라 배포하지 않는다.
- 교사·학생이 입력한 글은 `textContent` 로만 넣는다.
- DB 변경은 `supabase/migrations/` 에 쓰고, `supabase/tests/moaboard_rls_test.sql` 로 권한을 확인한다. `apps` 표에 등록할 때는 켜진 상태로 넣는다.
- `main` 에 합치면 GitHub Actions 가 학생 함수(moaboard-student)를 배포하고 포털 사이트를 다시 빌드한다.

## 대화 규칙

- 개발 용어(PR, 머지, 커밋, 브랜치, 배포, 마이그레이션, RLS 등)는 대화에서 처음 쓸 때 한 번, 괄호 안에 뜻이나 원래 단어를 함께 적는다. 예: PR(Pull Request, "제 변경을 합쳐 주세요"라는 요청서)
