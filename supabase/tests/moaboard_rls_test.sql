-- 모아보드 RLS 시험. 한 트랜잭션 안에서 실행하고 마지막에 롤백한다 → 가짜 데이터는 남지 않음.
-- 실행: Supabase SQL Editor 또는 MCP execute_sql 에 그대로 붙여 넣는다. 마지막 결과 표의 pass 가 모두 true 여야 한다.
begin;
set local search_path = public;
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t1@test.invalid','{"provider":"kakao"}','{"name":"교사A"}',now(),now()),
       ('22222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t2@test.invalid','{"provider":"kakao"}','{"name":"교사B"}',now(),now()),
       ('33333333-3333-4333-8333-333333333333','00000000-0000-0000-0000-000000000000','authenticated','authenticated','t3@test.invalid','{"provider":"kakao"}','{"name":"미인증"}',now(),now());
update profiles set teacher_status='verified' where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
insert into students (id, teacher_id, grade, class_no, name) values
  ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',3,2,'가짜학생1');
insert into moaboard_boards (id, teacher_id, title, layout) values
  ('b0000000-0000-4000-8000-00000000000a','11111111-1111-4111-8111-111111111111','A의 보드','column'),
  ('b0000000-0000-4000-8000-00000000000b','22222222-2222-4222-8222-222222222222','B의 보드','wall');
insert into moaboard_sections (id, board_id, title) values
  ('c0000000-0000-4000-8000-00000000000a','b0000000-0000-4000-8000-00000000000a','A칸'),
  ('c0000000-0000-4000-8000-00000000000b','b0000000-0000-4000-8000-00000000000b','B칸');
-- 학생 글(서버 함수가 넣는 것과 같음) 1개: 확인 기다림
insert into moaboard_posts (id, board_id, section_id, student_id, author_name, body, status) values
  ('d0000000-0000-4000-8000-00000000000a','b0000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','가짜학생1','학생 글','pending'),
  ('d0000000-0000-4000-8000-00000000000b','b0000000-0000-4000-8000-00000000000b',null,null,'선생님','B 글','visible');
update moaboard_posts set by_teacher = true where id = 'd0000000-0000-4000-8000-00000000000b';

create temp table r (n int generated always as identity, name text, pass bool) on commit drop;
grant all on r to authenticated, anon; grant usage, select on sequence r_n_seq to authenticated, anon;

-- 교사A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into r(name,pass) select '교사A: 자기 보드만 보임', (select count(*) from moaboard_boards)=1;
insert into r(name,pass) select '교사A: 다른 교사의 글·칸 안 보임', (select count(*) from moaboard_posts)=1 and (select count(*) from moaboard_sections)=1;
insert into r(name,pass) select '교사A: 글 수 함수는 자기 보드만', (select count(*) from moaboard_board_counts())=1 and (select pending_count from moaboard_board_counts())=1;
insert into moaboard_posts (board_id, section_id, by_teacher, author_name, title) values ('b0000000-0000-4000-8000-00000000000a','c0000000-0000-4000-8000-00000000000a',true,'선생님','교사 글');
insert into r(name,pass) select '교사A: 자기 보드에 교사 글 쓰기', (select count(*) from moaboard_posts where title='교사 글')=1;
update moaboard_posts set status='visible' where id='d0000000-0000-4000-8000-00000000000a';
insert into r(name,pass) select '교사A: 학생 글 보이기(확인)', (select status from moaboard_posts where id='d0000000-0000-4000-8000-00000000000a')='visible';
do $$ begin
  insert into moaboard_posts (board_id, by_teacher, author_name, body) values ('b0000000-0000-4000-8000-00000000000a', false, '가짜학생1', '흉내');
  insert into r(name,pass) values ('교사A: 학생 글 흉내 막힘', false);
exception when others then insert into r(name,pass) values ('교사A: 학생 글 흉내 막힘', true); end $$;
do $$ begin
  insert into moaboard_posts (board_id, by_teacher, author_name, body) values ('b0000000-0000-4000-8000-00000000000b', true, '선생님', '남의 보드');
  insert into r(name,pass) values ('교사A: 다른 교사 보드에 글 못 씀', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 교사 보드에 글 못 씀', true); end $$;
do $$ begin
  insert into moaboard_posts (board_id, section_id, by_teacher, author_name, body) values ('b0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000b', true, '선생님', '남의 칸');
  insert into r(name,pass) values ('교사A: 다른 보드의 칸에 글 못 넣음', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 보드의 칸에 글 못 넣음', true); end $$;
do $$ begin
  insert into moaboard_posts (board_id, by_teacher, author_name) values ('b0000000-0000-4000-8000-00000000000a', true, '선생님');
  insert into r(name,pass) values ('교사A: 빈 글 막힘', false);
exception when others then insert into r(name,pass) values ('교사A: 빈 글 막힘', true); end $$;
update moaboard_posts set body='바꿈' where id='d0000000-0000-4000-8000-00000000000b';
insert into moaboard_comments (post_id, by_teacher, author_name, body) values ('d0000000-0000-4000-8000-00000000000a', true, '선생님', '좋아요');
insert into moaboard_reactions (post_id, actor_id, kind) values ('d0000000-0000-4000-8000-00000000000a','11111111-1111-4111-8111-111111111111','like');
insert into r(name,pass) select '교사A: 댓글·반응 쓰기', (select count(*) from moaboard_comments)=1 and (select count(*) from moaboard_reactions)=1;
do $$ begin
  insert into moaboard_reactions (post_id, actor_id, kind) values ('d0000000-0000-4000-8000-00000000000a','aaaaaaaa-0000-4000-8000-000000000001','👍');
  insert into r(name,pass) values ('교사A: 학생 대신 반응 못 함', false);
exception when others then insert into r(name,pass) values ('교사A: 학생 대신 반응 못 함', true); end $$;
do $$ begin
  insert into moaboard_reactions (post_id, actor_id, kind) values ('d0000000-0000-4000-8000-00000000000b','11111111-1111-4111-8111-111111111111','like');
  insert into r(name,pass) values ('교사A: 다른 교사 글에 반응 못 함', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 교사 글에 반응 못 함', true); end $$;
do $$ begin
  update moaboard_boards set teacher_id='22222222-2222-4222-8222-222222222222' where id='b0000000-0000-4000-8000-00000000000a';
  insert into r(name,pass) values ('교사A: 보드 주인 못 바꿈', false);
exception when others then insert into r(name,pass) values ('교사A: 보드 주인 못 바꿈', true); end $$;
insert into storage.objects (bucket_id, name) values ('moaboard-files','11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/t/x.png');
insert into r(name,pass) select '교사A: 자기 보드 폴더에 파일 올리기', (select count(*) from storage.objects)=1;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('moaboard-files','11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/aaaaaaaa-0000-4000-8000-000000000001/x.png');
  insert into r(name,pass) values ('교사A: 학생 폴더에는 못 올림', false);
exception when others then insert into r(name,pass) values ('교사A: 학생 폴더에는 못 올림', true); end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('moaboard-files','22222222-2222-4222-8222-222222222222/b0000000-0000-4000-8000-00000000000b/t/x.png');
  insert into r(name,pass) values ('교사A: 다른 교사 폴더에 못 올림', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 교사 폴더에 못 올림', true); end $$;

do $$ begin
  update moaboard_boards set bg_preset='cream-dots', card_color='pink', bg_image_path='11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/t/bg.jpg' where id='b0000000-0000-4000-8000-00000000000a';
  insert into r(name,pass) values ('교사A: 보드 꾸미기(무늬·카드 색·자기 폴더 배경 사진) 저장', true);
exception when others then insert into r(name,pass) values ('교사A: 보드 꾸미기(무늬·카드 색·자기 폴더 배경 사진) 저장', false); end $$;
do $$ begin
  update moaboard_boards set bg_image_path='22222222-2222-4222-8222-222222222222/b0000000-0000-4000-8000-00000000000b/t/x.jpg' where id='b0000000-0000-4000-8000-00000000000a';
  insert into r(name,pass) values ('교사A: 다른 교사 파일을 배경으로 못 씀', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 교사 파일을 배경으로 못 씀', true); end $$;
do $$ begin
  update moaboard_posts set image_path='22222222-2222-4222-8222-222222222222/b0000000-0000-4000-8000-00000000000b/x/x.png' where id='d0000000-0000-4000-8000-00000000000a';
  insert into r(name,pass) values ('교사A: 다른 보드 파일을 글 사진으로 못 씀', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 보드 파일을 글 사진으로 못 씀', true); end $$;

-- 폴더·즐겨찾기·휴지통
insert into moaboard_folders (teacher_id, name) values ('11111111-1111-4111-8111-111111111111','과학');
update moaboard_boards set folder_id=(select id from moaboard_folders where name='과학'), favorite=true where id='b0000000-0000-4000-8000-00000000000a';
insert into r(name,pass) select '교사A: 자기 폴더에 보드 넣기·즐겨찾기', (select folder_id is not null and favorite from moaboard_boards where id='b0000000-0000-4000-8000-00000000000a');
do $$ begin
  insert into moaboard_folders (teacher_id, name) values ('22222222-2222-4222-8222-222222222222','남의 폴더');
  insert into r(name,pass) values ('교사A: 다른 교사 이름으로 폴더 못 만듦', false);
exception when others then insert into r(name,pass) values ('교사A: 다른 교사 이름으로 폴더 못 만듦', true); end $$;

-- 공통 파일 모듈 경로(moaboard/<교사>/<보드>/<학생 또는 t>/<uuid>.<확장자>)
update moaboard_posts set image_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/t/eeeeeeee-0000-4000-8000-000000000001.jpg' where title='교사 글';
insert into r(name,pass) select '교사A: 새 경로(교사 t) 사진 붙이기', (select image_path like 'moaboard/%' from moaboard_posts where title='교사 글');
update moaboard_posts set video_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/aaaaaaaa-0000-4000-8000-000000000001/eeeeeeee-0000-4000-8000-000000000001.mp4', video_name='v.mp4' where id='d0000000-0000-4000-8000-00000000000a';
insert into r(name,pass) select '교사A: 학생 글에 그 학생의 새 경로 영상', (select video_path is not null from moaboard_posts where id='d0000000-0000-4000-8000-00000000000a');
update moaboard_boards set bg_image_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/t/eeeeeeee-0000-4000-8000-000000000001.jpg' where id='b0000000-0000-4000-8000-00000000000a';
insert into r(name,pass) select '교사A: 새 경로 배경 사진', (select bg_image_path like 'moaboard/%' from moaboard_boards where id='b0000000-0000-4000-8000-00000000000a');
do $$ begin
  update moaboard_posts set image_path='moaboard/22222222-2222-4222-8222-222222222222/b0000000-0000-4000-8000-00000000000a/t/eeeeeeee-0000-4000-8000-000000000001.jpg' where title='교사 글';
  insert into r(name,pass) values ('새 경로: 다른 교사 폴더 거부', false);
exception when others then insert into r(name,pass) values ('새 경로: 다른 교사 폴더 거부', true); end $$;
do $$ begin
  update moaboard_posts set image_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000b/t/eeeeeeee-0000-4000-8000-000000000001.jpg' where title='교사 글';
  insert into r(name,pass) values ('새 경로: 다른 보드 거부', false);
exception when others then insert into r(name,pass) values ('새 경로: 다른 보드 거부', true); end $$;
do $$ begin
  update moaboard_posts set image_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/aaaaaaaa-0000-4000-8000-000000000002/eeeeeeee-0000-4000-8000-000000000001.jpg' where id='d0000000-0000-4000-8000-00000000000a';
  insert into r(name,pass) values ('새 경로: 다른 학생 파일 거부', false);
exception when others then insert into r(name,pass) values ('새 경로: 다른 학생 파일 거부', true); end $$;
do $$ begin
  update moaboard_posts set image_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/t/../x/eeeeeeee-0000-4000-8000-000000000001.jpg' where title='교사 글';
  insert into r(name,pass) values ('새 경로: 칸이 더 많은 경로(../) 거부', false);
exception when others then insert into r(name,pass) values ('새 경로: 칸이 더 많은 경로(../) 거부', true); end $$;
do $$ begin
  update moaboard_boards set bg_image_path='moaboard/11111111-1111-4111-8111-111111111111/b0000000-0000-4000-8000-00000000000a/aaaaaaaa-0000-4000-8000-000000000001/eeeeeeee-0000-4000-8000-000000000001.jpg' where id='b0000000-0000-4000-8000-00000000000a';
  insert into r(name,pass) values ('새 경로: 배경은 교사 파일(t)만', false);
exception when others then insert into r(name,pass) values ('새 경로: 배경은 교사 파일(t)만', true); end $$;

-- 교사B: A가 한 일이 B 쪽에 없는지
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
insert into r(name,pass) select '교사B: 자기 글은 그대로(A가 못 고침)', (select body from moaboard_posts where id='d0000000-0000-4000-8000-00000000000b')='B 글';
insert into r(name,pass) select '교사B: A의 폴더 안 보임', (select count(*) from moaboard_folders)=0;
do $$ begin
  update moaboard_boards set folder_id=(select id from moaboard_folders where name='과학' limit 1) where id='b0000000-0000-4000-8000-00000000000b';
  if not found or (select folder_id from moaboard_boards where id='b0000000-0000-4000-8000-00000000000b') is null then raise exception 'blocked'; end if;
  insert into r(name,pass) values ('교사B: 다른 교사 폴더에 보드 못 넣음', false);
exception when others then insert into r(name,pass) values ('교사B: 다른 교사 폴더에 보드 못 넣음', true); end $$;
insert into r(name,pass) select '교사B: A의 댓글·반응·파일 안 보임', (select count(*) from moaboard_comments)=0 and (select count(*) from moaboard_reactions)=0 and (select count(*) from storage.objects)=0;

-- 미인증 교사·로그인 안 한 사람
select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);
do $$ begin
  insert into moaboard_boards (teacher_id, title) values ('33333333-3333-4333-8333-333333333333','미인증 보드');
  insert into r(name,pass) values ('미인증 교사: 보드 못 만듦', false);
exception when others then insert into r(name,pass) values ('미인증 교사: 보드 못 만듦', true); end $$;
set local role anon;
select set_config('request.jwt.claims', '', true);
do $$ begin
  perform 1 from moaboard_posts;
  insert into r(name,pass) values ('로그인 안 함: 글 못 읽음', false);
exception when others then insert into r(name,pass) values ('로그인 안 함: 글 못 읽음', true); end $$;

reset role;
-- 명단에서 학생을 지우면 글은 남고(올린 사람 칸 비움) 파일 경로 확인이 막지 않는다
delete from students where id='aaaaaaaa-0000-4000-8000-000000000001';
insert into r(name,pass) select '학생 삭제: 글과 파일 경로는 남음', (select student_id is null and video_path is not null from moaboard_posts where id='d0000000-0000-4000-8000-00000000000a');
-- 칸을 지우면 글은 남고 '칸 없음'으로
delete from moaboard_sections where id='c0000000-0000-4000-8000-00000000000a';
insert into r(name,pass) select '칸 지우기: 글은 남고 칸 없음', (select count(*) from moaboard_posts where board_id='b0000000-0000-4000-8000-00000000000a' and section_id is null)=2;
-- 보드를 지우면 글·댓글·반응도 함께
delete from moaboard_boards where id='b0000000-0000-4000-8000-00000000000a';
insert into r(name,pass) select '보드 지우기: 글·댓글·반응도 지워짐', (select count(*) from moaboard_posts where board_id='b0000000-0000-4000-8000-00000000000a')=0 and (select count(*) from moaboard_comments)=0 and (select count(*) from moaboard_reactions)=0;

select n, name, pass from r order by n;
rollback;
