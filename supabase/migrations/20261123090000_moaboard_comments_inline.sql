-- 모아보드: 댓글을 글 카드 아래에 바로 보일지(보드마다). 끄면 댓글 수만 보이고 눌러야 열린다.
-- 기본은 켜짐(이미 만든 보드도 켜짐).
alter table public.moaboard_boards add column comments_inline boolean not null default true;
grant insert (comments_inline), update (comments_inline) on public.moaboard_boards to authenticated;
