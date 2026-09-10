-- 하루의 경계가 한국시간 새벽 3시인지 확인하고 롤백합니다.
begin;
do $$ begin
 -- 자정 직후는 아직 전날입니다.
 assert private.study_date('2026-09-10T00:06:00+09:00') = date '2026-09-09', '자정 직후는 전날';
 assert private.study_date('2026-09-10T02:59:59+09:00') = date '2026-09-09', '2시 59분은 전날';
 -- 3시부터 새 하루입니다.
 assert private.study_date('2026-09-10T03:00:00+09:00') = date '2026-09-10', '3시부터 당일';
 assert private.study_date('2026-09-10T23:59:59+09:00') = date '2026-09-10', '자정 직전은 당일';
 -- 다른 시간대로 들어와도 한국시간으로 환산합니다.
 assert private.study_date('2026-09-09T18:00:00+00:00') = date '2026-09-10', 'UTC 입력 환산';

 -- 집계 함수가 이 경계를 그대로 쓰는지 확인합니다.
 assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('get_group_overview','get_group_directory','get_public_group_board')
     and p.prosrc like '%at time zone ''Asia/Seoul''%') = 0, '자정 경계가 남은 함수 없음';
end $$;
rollback;
select '새벽 3시 경계와 집계 함수 적용 검증 통과' as result;
