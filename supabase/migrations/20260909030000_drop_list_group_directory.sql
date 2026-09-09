-- 첫 화면이 get_group_directory()를 쓰도록 배포한 뒤 옛 함수를 지웁니다.
-- 배포 전에 지우면 구버전 화면의 목록이 비어 보이므로 순서를 지켜야 합니다.
begin;

drop function if exists public.list_group_directory();

commit;
