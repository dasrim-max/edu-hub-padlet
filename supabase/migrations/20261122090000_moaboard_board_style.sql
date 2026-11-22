-- 모아보드 보드 꾸미기: 배경 무늬·색(bg_preset), 배경 사진(bg_image_path), 카드 색(card_color).
-- 값은 화면 코드의 목록(site/js/board-style.js) 이름만 저장한다(색 값 자체는 저장하지 않음).
-- 파일 경로는 자기 보드 폴더(<교사 id>/<보드 id>/…)만 받는다: 다른 교사의 파일 경로를 넣어
-- 학생 함수(서버 키로 주소를 만듦)가 그 파일을 보여 주는 일을 막는다.

alter table public.moaboard_boards
  add column bg_preset text check (bg_preset is null or bg_preset ~ '^[a-z0-9-]{1,40}$'),
  add column bg_image_path text check (bg_image_path is null or (char_length(bg_image_path) <= 300
    and split_part(bg_image_path, '/', 1) = teacher_id::text and split_part(bg_image_path, '/', 2) = id::text)),
  add column card_color text check (card_color is null or card_color ~ '^[a-z]{1,20}$');

grant insert (bg_preset, bg_image_path, card_color), update (bg_preset, bg_image_path, card_color)
  on public.moaboard_boards to authenticated;

-- 글의 사진·파일도 그 보드 폴더 안의 경로만(두 번째 칸 = 보드 id)
alter table public.moaboard_posts
  add constraint moaboard_posts_image_in_board check (image_path is null or split_part(image_path, '/', 2) = board_id::text),
  add constraint moaboard_posts_file_in_board check (file_path is null or split_part(file_path, '/', 2) = board_id::text);
