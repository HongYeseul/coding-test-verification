-- 현황판이 자동 인정을 승인으로 세는지 확인하고 롤백합니다.
-- 자동 인정 그룹에서 이게 빠지면 누적과 이번 주 승인이 실제보다 적게 나오고,
-- 칸에 도장이 아예 찍히지 않아 도장판이 빈 것처럼 보입니다.
begin;

-- 인정으로 세는 상태는 세 함수가 같은 묶음을 써야 합니다.
-- 함수를 옛 정의에서 옮겨 쓰다 한 곳만 뒤처지면 여기서 잡힙니다.
do $$ begin
 assert (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('get_group_overview', 'get_group_directory', 'get_public_group_board')
     and p.prosrc like '%MANUAL_REVIEWED%'
     and p.prosrc not like '%AUTO_APPROVED%') = 0,
  '인정 집계에서 자동 인정이 빠진 함수 없음';
end $$;

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-00000000da01','count-owner@example.invalid'),
 ('00000000-0000-4000-8000-00000000da02','count-member@example.invalid');
-- 자동 인정을 켠 그룹입니다. 등록하는 순간 AUTO_APPROVED로 들어옵니다.
insert into public.groups(id,name,slug,owner_id,requires_photo,auto_approve) values
 ('00000000-0000-4000-8000-00000000db01','집계 검증','count-test','00000000-0000-4000-8000-00000000da01',false,true);
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-00000000db01','00000000-0000-4000-8000-00000000da02','MEMBER','ACTIVE',now());
insert into public.proofs(id,group_id,user_id,problem_key,accepted_at,verification_status) values
 ('00000000-0000-4000-8000-00000000dc01','00000000-0000-4000-8000-00000000db01','00000000-0000-4000-8000-00000000da02','자동 인정 1',now(),'AUTO_APPROVED'),
 ('00000000-0000-4000-8000-00000000dc02','00000000-0000-4000-8000-00000000db01','00000000-0000-4000-8000-00000000da02','자동 인정 2',now(),'AUTO_APPROVED'),
 ('00000000-0000-4000-8000-00000000dc03','00000000-0000-4000-8000-00000000db01','00000000-0000-4000-8000-00000000da02','검수 승인',now(),'MANUAL_REVIEWED'),
 ('00000000-0000-4000-8000-00000000dc04','00000000-0000-4000-8000-00000000db01','00000000-0000-4000-8000-00000000da02','반려',now(),'REJECTED');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000da02',true);
set local role authenticated;
do $$
declare
 overview jsonb;
 member jsonb;
begin
 overview := public.get_group_overview('00000000-0000-4000-8000-00000000db01');
 select value into member from jsonb_array_elements(overview->'members')
  where value->>'userId' = '00000000-0000-4000-8000-00000000da02';

 -- 자동 인정 2 + 검수 승인 1. 반려는 빠집니다.
 assert (member->>'totalApproved')::int = 3, '누적에 자동 인정 포함';
 assert (member->>'weekApproved')::int = 3, '이번 주 승인에 자동 인정 포함';
 assert (member->>'pending')::int = 0, '검수 대기에는 자동 인정이 들어가지 않음';
 -- 오늘 참여는 반려만 빼고 셉니다.
 assert (member->>'todaySubmitted')::int = 3, '오늘 참여 집계';

 -- 칸에도 도장이 찍혀야 합니다. 승인 3건이 오늘 하루에 몰려 있습니다.
 assert (select (day->>'approved')::int = 3 and (day->>'rejected')::int = 1
   from jsonb_array_elements(member->'days') as day
   where day->>'date' = overview->>'today'), '칸의 승인 건수에 자동 인정 포함';
end $$;
rollback;
select '현황판 인정 집계 검증 통과' as result;
