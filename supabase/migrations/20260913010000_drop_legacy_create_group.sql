-- 코딩 테스트 여부를 받는 3인자 create_group을 쓰는 화면이 배포된 뒤에 실행합니다.
-- 배포 전에 지우면 구버전 화면의 그룹 만들기가 실패하므로 순서를 지켜야 합니다.
begin;

drop function if exists public.create_group(text, text);

commit;
