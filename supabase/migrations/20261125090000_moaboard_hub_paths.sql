-- 모아보드 → 쌤허브 공통 파일 모듈(hub-files) 1단계: 경로 규칙을 새 형식도 받게 바꾼다.
--   새 형식(공통 모듈): moaboard/<보드 주인 교사 id>/<보드 id>/<학생 id 또는 t>/<uuid>.<확장자>
--   예전 형식(moaboard-files 버킷): <교사 id>/<보드 id>/<학생 id 또는 t>/<uuid>.<확장자>  ← 예전 파일을 다 옮길 때까지 받는다
-- 글의 사진·파일·영상은 보드 주인 교사와 그 글의 학생(또는 교사 t) 폴더 것만 붙일 수 있다.
-- 다른 교사·다른 보드·다른 학생의 파일을 붙여 학생 함수(서버 키로 보기 주소를 만듦)가 보여 주는 일을 막는다.

-- 경로 하나 확인: 보드 주인 teacher, 보드 board, 올린 사람 owner
--   owner: 't'(교사 글·배경) / 학생 id(학생 글: 그 학생 또는 교사 t) / null(명단에서 지운 학생의 글: 올린 사람은 따지지 않음)
create function public.moaboard_path_ok(p text, teacher uuid, board uuid, owner text) returns boolean
  language sql immutable set search_path = '' as $$
  select p is null or (
    char_length(p) <= 300 and (
      -- 새 형식
      (split_part(p, '/', 1) = 'moaboard' and split_part(p, '/', 2) = teacher::text and split_part(p, '/', 3) = board::text
        and split_part(p, '/', 4) in ('t', coalesce(owner, split_part(p, '/', 4))) and split_part(p, '/', 6) = '')
      or
      -- 예전 형식
      (split_part(p, '/', 1) = teacher::text and split_part(p, '/', 2) = board::text
        and split_part(p, '/', 3) in ('t', coalesce(owner, split_part(p, '/', 3))) and split_part(p, '/', 5) = '')
    ))
$$;
revoke execute on function public.moaboard_path_ok(text, uuid, uuid, text) from public, anon;
grant execute on function public.moaboard_path_ok(text, uuid, uuid, text) to authenticated;   -- 배경 경로 제약이 교사 권한으로 부름

-- 글: 보드 주인은 다른 표에 있어서 트리거로 확인
create function public.moaboard_check_post_paths() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare t uuid; o text;
begin
  if new.image_path is null and new.file_path is null and new.video_path is null then return new; end if;
  select teacher_id into t from public.moaboard_boards where id = new.board_id;
  o := case when new.by_teacher then 't' when new.student_id is not null then new.student_id::text end;
  if not (public.moaboard_path_ok(new.image_path, t, new.board_id, o)
      and public.moaboard_path_ok(new.file_path, t, new.board_id, o)
      and public.moaboard_path_ok(new.video_path, t, new.board_id, o)) then
    raise exception '붙인 파일이 이 보드의 것이 아니에요' using errcode = 'check_violation';
  end if;
  return new;
end $$;
revoke execute on function public.moaboard_check_post_paths() from public, anon, authenticated;
create trigger moaboard_posts_paths before insert or update of image_path, file_path, video_path, board_id, student_id, by_teacher
  on public.moaboard_posts for each row execute function public.moaboard_check_post_paths();

alter table public.moaboard_posts drop constraint if exists moaboard_posts_image_in_board;
alter table public.moaboard_posts drop constraint if exists moaboard_posts_file_in_board;
alter table public.moaboard_posts drop constraint if exists moaboard_posts_check2;          -- 영상 경로(예전 형식만)

-- 배경 사진: 같은 행에 교사 id 가 있어서 제약으로(교사 파일 t 만)
alter table public.moaboard_boards drop constraint if exists moaboard_boards_check;          -- 배경 경로(예전 형식만)
alter table public.moaboard_boards add constraint moaboard_boards_bg_path_ok
  check (public.moaboard_path_ok(bg_image_path, teacher_id, id, 't'));
