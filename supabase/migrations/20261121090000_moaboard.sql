-- 모아보드(moaboard): 학생들의 글·사진·파일을 한 보드에 모으는 앱.
-- 교사는 자기 보드만 다룬다(RLS). 학생은 DB를 직접 쓰지 못하고 서버 함수(moaboard-student)를 거친다.
-- 파일은 비공개 저장소 moaboard-files 에 두고, 보여 줄 때는 잠깐 쓰는 주소(signed URL)를 만든다.
--   경로: <교사 id>/<보드 id>/t/<무작위>.<확장자>  (교사)
--         <교사 id>/<보드 id>/<학생 id>/<무작위>.<확장자>  (학생: 서버 함수가 올릴 주소를 만들어 줌)

-- ------------------------------------------------------------------
-- 1. 표
-- ------------------------------------------------------------------
create table public.moaboard_boards (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 200),
  layout text not null default 'wall' check (layout in ('wall', 'column', 'grid')),   -- 담벼락 / 칸 / 묶음
  needs_approval boolean not null default false,   -- 선생님이 확인한 글만 친구들에게 보임
  allow_post boolean not null default true,
  allow_comments boolean not null default true,
  allow_like boolean not null default true,
  allow_emoji boolean not null default true,
  allow_files boolean not null default true,
  show_names boolean not null default true,        -- 끄면 학생 화면에서 친구 이름을 숨김(교사는 늘 보임)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index moaboard_boards_teacher_idx on public.moaboard_boards (teacher_id, updated_at desc);

create table public.moaboard_sections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.moaboard_boards(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 30),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, board_id)                            -- 글의 칸이 같은 보드의 칸인지 묶어서 확인
);
create index moaboard_sections_board_idx on public.moaboard_sections (board_id, position);

create table public.moaboard_posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.moaboard_boards(id) on delete cascade,
  section_id uuid,
  position int not null default 0,
  student_id uuid references public.students(id) on delete set null,   -- 비어 있으면 교사 글(by_teacher)이거나 명단에서 지운 학생
  by_teacher boolean not null default false,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 50),
  title text not null default '' check (char_length(title) <= 60),
  body text not null default '' check (char_length(body) <= 1000),
  image_path text check (image_path is null or char_length(image_path) <= 300),
  file_path text check (file_path is null or char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) between 1 and 200),
  file_size int check (file_size is null or file_size between 0 and 20971520),
  status text not null default 'visible' check (status in ('visible', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (section_id, board_id) references public.moaboard_sections(id, board_id) on delete set null (section_id),
  check (char_length(btrim(title)) > 0 or char_length(btrim(body)) > 0 or image_path is not null or file_path is not null),
  check ((file_path is null) = (file_name is null))
);
create index moaboard_posts_board_idx on public.moaboard_posts (board_id, section_id, position);
create index moaboard_posts_student_idx on public.moaboard_posts (board_id, student_id);

create table public.moaboard_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.moaboard_posts(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  by_teacher boolean not null default false,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 50),
  body text not null check (char_length(btrim(body)) between 1 and 200),
  created_at timestamptz not null default now()
);
create index moaboard_comments_post_idx on public.moaboard_comments (post_id, created_at);

-- 반응: 누른 사람(actor_id = 학생 id 또는 교사 id) 한 명이 글 하나에 종류마다 한 번
create table public.moaboard_reactions (
  post_id uuid not null references public.moaboard_posts(id) on delete cascade,
  actor_id uuid not null,
  kind text not null check (kind in ('like', '👍', '😊', '😮', '👏', '🤔')),
  created_at timestamptz not null default now(),
  primary key (post_id, actor_id, kind)
);

-- ------------------------------------------------------------------
-- 2. 고친 시각: 보드 설정·글이 바뀌면 보드의 updated_at 도 새로(보드 목록 정렬)
-- ------------------------------------------------------------------
create function public.moaboard_touch() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create function public.moaboard_bump_board() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.moaboard_boards set updated_at = now()
   where id = coalesce(new.board_id, old.board_id) and updated_at < now() - interval '2 seconds';
  return null;
end $$;
revoke execute on function public.moaboard_touch(), public.moaboard_bump_board() from public, anon, authenticated;
create trigger moaboard_boards_touch before update on public.moaboard_boards for each row execute function public.moaboard_touch();
create trigger moaboard_posts_touch before update on public.moaboard_posts for each row execute function public.moaboard_touch();
create trigger moaboard_posts_bump after insert or update or delete on public.moaboard_posts for each row execute function public.moaboard_bump_board();

-- ------------------------------------------------------------------
-- 3. 권한(RLS). 교사: 인증된 교사 + 자기 보드. 학생: 정책 없음(서버 함수가 service 키로 접근)
-- ------------------------------------------------------------------
create function public.moaboard_owns_board(p_board uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select (select private.is_verified_teacher())
     and exists (select 1 from public.moaboard_boards b where b.id = p_board and b.teacher_id = (select auth.uid()))
$$;
create function public.moaboard_owns_post(p_post uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select (select private.is_verified_teacher())
     and exists (select 1 from public.moaboard_posts p join public.moaboard_boards b on b.id = p.board_id
                 where p.id = p_post and b.teacher_id = (select auth.uid()))
$$;
revoke execute on function public.moaboard_owns_board(uuid), public.moaboard_owns_post(uuid) from public, anon;
grant execute on function public.moaboard_owns_board(uuid), public.moaboard_owns_post(uuid) to authenticated;

alter table public.moaboard_boards    enable row level security;
alter table public.moaboard_sections  enable row level security;
alter table public.moaboard_posts     enable row level security;
alter table public.moaboard_comments  enable row level security;
alter table public.moaboard_reactions enable row level security;
revoke all on public.moaboard_boards, public.moaboard_sections, public.moaboard_posts, public.moaboard_comments, public.moaboard_reactions from anon, authenticated;

-- 교사가 쓸 수 있는 칸만 열어 둔다(학생 id·만든 시각 등은 교사가 정할 수 없음)
grant select, delete on public.moaboard_boards to authenticated;
grant insert (teacher_id, title, description, layout, needs_approval, allow_post, allow_comments, allow_like, allow_emoji, allow_files, show_names),
      update (title, description, layout, needs_approval, allow_post, allow_comments, allow_like, allow_emoji, allow_files, show_names)
  on public.moaboard_boards to authenticated;
grant select, delete on public.moaboard_sections to authenticated;
grant insert (board_id, title, position), update (title, position) on public.moaboard_sections to authenticated;
grant select, delete on public.moaboard_posts to authenticated;
grant insert (board_id, section_id, position, by_teacher, author_name, title, body, image_path, file_path, file_name, file_size, status),
      update (section_id, position, title, body, image_path, file_path, file_name, file_size, status)
  on public.moaboard_posts to authenticated;
grant select, delete on public.moaboard_comments to authenticated;
grant insert (post_id, by_teacher, author_name, body) on public.moaboard_comments to authenticated;
grant select on public.moaboard_reactions to authenticated;
grant insert (post_id, actor_id, kind), delete on public.moaboard_reactions to authenticated;

create policy moaboard_boards_owner on public.moaboard_boards for all to authenticated
  using (teacher_id = (select auth.uid()) and (select private.is_verified_teacher()))
  with check (teacher_id = (select auth.uid()) and (select private.is_verified_teacher()));
create policy moaboard_sections_owner on public.moaboard_sections for all to authenticated
  using ((select public.moaboard_owns_board(board_id))) with check ((select public.moaboard_owns_board(board_id)));
-- 교사가 새로 쓰는 글은 교사 글로만(학생 글을 흉내 낼 수 없음)
create policy moaboard_posts_read on public.moaboard_posts for select to authenticated using ((select public.moaboard_owns_board(board_id)));
create policy moaboard_posts_insert on public.moaboard_posts for insert to authenticated
  with check ((select public.moaboard_owns_board(board_id)) and by_teacher and student_id is null);
create policy moaboard_posts_update on public.moaboard_posts for update to authenticated
  using ((select public.moaboard_owns_board(board_id))) with check ((select public.moaboard_owns_board(board_id)));
create policy moaboard_posts_delete on public.moaboard_posts for delete to authenticated using ((select public.moaboard_owns_board(board_id)));
create policy moaboard_comments_read on public.moaboard_comments for select to authenticated using ((select public.moaboard_owns_post(post_id)));
create policy moaboard_comments_insert on public.moaboard_comments for insert to authenticated
  with check ((select public.moaboard_owns_post(post_id)) and by_teacher and student_id is null);
create policy moaboard_comments_delete on public.moaboard_comments for delete to authenticated using ((select public.moaboard_owns_post(post_id)));
create policy moaboard_reactions_read on public.moaboard_reactions for select to authenticated using ((select public.moaboard_owns_post(post_id)));
create policy moaboard_reactions_insert on public.moaboard_reactions for insert to authenticated
  with check ((select public.moaboard_owns_post(post_id)) and actor_id = (select auth.uid()));
create policy moaboard_reactions_delete on public.moaboard_reactions for delete to authenticated
  using ((select public.moaboard_owns_post(post_id)) and actor_id = (select auth.uid()));

-- 보드 목록의 글 수(보이는 글 · 확인 기다림). 부른 교사의 권한(RLS)으로 센다
create function public.moaboard_board_counts() returns table (board_id uuid, post_count bigint, pending_count bigint)
  language sql stable security invoker set search_path = '' as $$
  select p.board_id, count(*) filter (where p.status = 'visible'), count(*) filter (where p.status = 'pending')
    from public.moaboard_posts p group by p.board_id
$$;
revoke execute on function public.moaboard_board_counts() from public, anon;
grant execute on function public.moaboard_board_counts() to authenticated;

-- ------------------------------------------------------------------
-- 4. 실시간 반영(교사 화면). 교사는 RLS 로 자기 보드의 바뀐 행만 받는다
-- ------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.moaboard_boards, public.moaboard_sections,
      public.moaboard_posts, public.moaboard_comments, public.moaboard_reactions;
  end if;
end $$;

-- ------------------------------------------------------------------
-- 5. 파일 저장소(비공개). 교사는 자기 폴더(<교사 id>/…)만. 학생은 서버 함수가 만든 올릴 주소로만 올린다
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moaboard-files', 'moaboard-files', false, 20971520, null)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy moaboard_files_teacher_read on storage.objects for select to authenticated
  using (bucket_id = 'moaboard-files' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_verified_teacher()));
create policy moaboard_files_teacher_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'moaboard-files' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (storage.foldername(name))[3] = 't'
              and (select public.moaboard_owns_board(((storage.foldername(name))[2])::uuid)));
create policy moaboard_files_teacher_delete on storage.objects for delete to authenticated
  using (bucket_id = 'moaboard-files' and (storage.foldername(name))[1] = (select auth.uid())::text and (select private.is_verified_teacher()));

-- ------------------------------------------------------------------
-- 6. 포털 앱 등록. 화면을 배포하기 전에는 보이지 않게 꺼 둔다(관리자 화면에서 켠다)
--    스타일 번호는 비워 둔다 = 애플 기본 스타일. 보드를 만들고 지우는 앱이라 "내가 만든 활동"을 켠다.
--    수업 흐름에 "앱 전체"로 넣으면 학생은 보드 고르기 화면으로 들어온다(app_entry).
-- ------------------------------------------------------------------
insert into public.apps (slug, name, url, icon, category, sort_order, is_active, color, description, show_activities, app_entry)
values ('moaboard', '모아보드', '/moaboard/', '📌', 'learning', 20, false, '#3b8fe0', '학생들의 생각·사진·파일을 한 보드에 모아요', true, true)
on conflict (slug) do nothing;
