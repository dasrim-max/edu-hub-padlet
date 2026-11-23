-- 모아보드: 글에 영상 붙이기(mp4·webm·mov, 50MB). 카드에는 첫 장면이 미리보기로 보이고 누르면 재생한다.
-- 영상 경로도 그 보드 폴더 안만(두 번째 칸 = 보드 id). 영상만 있는 글도 빈 글이 아니다.
-- 저장소 한 파일 한도를 50MB 로(Supabase 무료 플랜의 파일 한 개 최대 크기).

alter table public.moaboard_posts
  add column video_path text check (video_path is null or (char_length(video_path) <= 300 and split_part(video_path, '/', 2) = board_id::text)),
  add column video_name text check (video_name is null or char_length(video_name) between 1 and 200),
  add column video_size int check (video_size is null or video_size between 0 and 52428800);

alter table public.moaboard_posts drop constraint moaboard_posts_check;
alter table public.moaboard_posts add constraint moaboard_posts_not_empty
  check (char_length(btrim(title)) > 0 or char_length(btrim(body)) > 0 or image_path is not null or file_path is not null or video_path is not null);

grant insert (video_path, video_name, video_size), update (video_path, video_name, video_size) on public.moaboard_posts to authenticated;

update storage.buckets set file_size_limit = 52428800 where id = 'moaboard-files';
