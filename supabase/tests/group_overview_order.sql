-- 현황판 멤버 순서가 주간 승인 건수 내림차순, 같으면 닉네임순인지 확인하고 모두 롤백합니다.
begin;
-- 닉네임은 가입 트리거가 이메일 앞부분에서 만듭니다.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000d1','zeta@example.invalid'),
 ('00000000-0000-4000-8000-0000000000d2','alpha@example.invalid'),
 ('00000000-0000-4000-8000-0000000000d3','beta@example.invalid');
insert into public.groups(id,name,slug,owner_id,created_at) values
 ('00000000-0000-4000-8000-0000000000e1','정렬 검증','overview-order-test',
  '00000000-0000-4000-8000-0000000000d1',now()-interval '30 days');
insert into public.group_members(group_id,user_id,role,status) values
 ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000d2','MEMBER','ACTIVE'),
 ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000d3','MEMBER','ACTIVE');
insert into public.platform_accounts(id,user_id,platform,handle) values
 ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000d1','CODEFORCES','order-zeta'),
 ('00000000-0000-4000-8000-0000000000f3','00000000-0000-4000-8000-0000000000d3','CODEFORCES','order-beta');
-- zeta만 이번 주 승인 2건, alpha와 beta는 0건입니다.
insert into public.proofs(group_id,user_id,platform_account_id,problem_key,problem_url,accepted_at,created_at,verification_status)
select '00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000d1',
 '00000000-0000-4000-8000-0000000000f1','zeta-'||n,'https://example.invalid',now(),now(),'MANUAL_REVIEWED'
from generate_series(1,2) n;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d1',true);
set local role authenticated;
do $$
declare
 overview jsonb;
 names text[];
begin
 overview := public.get_group_overview('00000000-0000-4000-8000-0000000000e1');
 select array_agg(value->>'displayName' order by ordinality)
 into names from jsonb_array_elements(overview->'members') with ordinality;
 -- 승인 2건인 zeta가 먼저, 0건인 두 사람은 닉네임순입니다.
 assert names = array['zeta','alpha','beta'],
  '주간 승인 내림차순과 닉네임 tiebreak 실패: ' || names::text;
end $$;
reset role;

-- beta가 3건을 채우면 순서가 다시 계산돼야 합니다.
insert into public.proofs(group_id,user_id,platform_account_id,problem_key,problem_url,accepted_at,created_at,verification_status)
select '00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000d3',
 '00000000-0000-4000-8000-0000000000f3','beta-'||n,'https://example.invalid',now(),now(),'MANUAL_REVIEWED'
from generate_series(1,3) n;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000d1',true);
set local role authenticated;
do $$
declare
 overview jsonb;
 names text[];
begin
 overview := public.get_group_overview('00000000-0000-4000-8000-0000000000e1');
 select array_agg(value->>'displayName' order by ordinality)
 into names from jsonb_array_elements(overview->'members') with ordinality;
 assert names = array['beta','zeta','alpha'],
  '승인 건수 변화가 순서에 반영되지 않음: ' || names::text;

 -- 기록이 없는 멤버가 NULL 때문에 맨 앞으로 오지 않아야 합니다.
 assert (overview->'members'->2->>'displayName') = 'alpha',
  '기록 없는 멤버가 맨 뒤가 아님';
end $$;
reset role;
rollback;
select '현황판 멤버 정렬(주간 승인 내림차순, 닉네임 tiebreak) 검증 통과, 테스트 데이터 롤백 완료' as result;
