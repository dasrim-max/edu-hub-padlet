-- 모아보드 보드 목록: 폴더 · 즐겨찾기 · 휴지통 · 최근 연 시각
-- - 폴더는 교사마다 따로. 보드는 자기 폴더에만 넣을 수 있다(다른 교사 폴더 id 를 넣지 못하게 묶음 외래 키)
-- - 휴지통: deleted_at 이 있으면 휴지통. 학생은 들어올 수 없다(학생 함수가 확인). 30일 지나면 화면이 영구 삭제한다
-- - 최근 사용 정렬: last_opened_at (교사가 보드를 열 때 새로)

create table public.moaboard_folders (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, teacher_id)
);
create index moaboard_folders_teacher_idx on public.moaboard_folders (teacher_id, position);

alter table public.moaboard_boards
  add column folder_id uuid,
  add column favorite boolean not null default false,
  add column deleted_at timestamptz,
  add column last_opened_at timestamptz not null default now(),
  add constraint moaboard_boards_folder_fk foreign key (folder_id, teacher_id)
    references public.moaboard_folders(id, teacher_id) on delete set null (folder_id);
create index moaboard_boards_folder_idx on public.moaboard_boards (teacher_id, folder_id);

alter table public.moaboard_folders enable row level security;
revoke all on public.moaboard_folders from anon, authenticated;
grant select, delete on public.moaboard_folders to authenticated;
grant insert (teacher_id, name, position), update (name, position) on public.moaboard_folders to authenticated;
create policy moaboard_folders_owner on public.moaboard_folders for all to authenticated
  using (teacher_id = (select auth.uid()) and (select private.is_verified_teacher()))
  with check (teacher_id = (select auth.uid()) and (select private.is_verified_teacher()));

grant insert (folder_id, favorite), update (folder_id, favorite, deleted_at, last_opened_at) on public.moaboard_boards to authenticated;
