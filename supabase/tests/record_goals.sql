-- 기록 종류와 멤버별 목표가 어디까지 열려 있는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-00000000ba01','goal-owner@example.invalid'),
 ('00000000-0000-4000-8000-00000000ba02','goal-member@example.invalid'),
 ('00000000-0000-4000-8000-00000000ba03','goal-outsider@example.invalid');
-- 사진 필수를 켠 채로 시각을 기록하는 그룹입니다. 기록값이 사진을 대신하는지 봅니다.
insert into public.groups(id,name,slug,owner_id,requires_photo,record_kind) values
 ('00000000-0000-4000-8000-00000000bb01','기상 검증','wake-test','00000000-0000-4000-8000-00000000ba01',true,'CLOCK'),
 ('00000000-0000-4000-8000-00000000bb02','기록 없음','plain-test','00000000-0000-4000-8000-00000000ba01',false,'NONE');
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-00000000bb01','00000000-0000-4000-8000-00000000ba02','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-00000000bb02','00000000-0000-4000-8000-00000000ba02','MEMBER','ACTIVE',now());

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ba02',true);
set local role authenticated;
do $$
declare
 wake_group uuid := '00000000-0000-4000-8000-00000000bb01';
 plain_group uuid := '00000000-0000-4000-8000-00000000bb02';
 member_id uuid := '00000000-0000-4000-8000-00000000ba02';
begin
 -- 시각을 남기면 사진 필수를 켠 그룹에서도 사진 없이 등록됩니다.
 insert into public.proofs(group_id,user_id,problem_key,accepted_at,record_minutes)
 values (wake_group,member_id,'기상 1',now(),388);
 assert (select record_minutes = 388 from public.proofs
  where group_id = wake_group and problem_key = '기상 1'), '기록값 저장';

 -- 아무 근거도 기록값도 없으면 여전히 막힙니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at)
  values (wake_group,member_id,'맨손',now());
  raise exception '근거 없는 기록 허용';
 -- BEFORE 트리거가 RLS보다 먼저 걸려 P0001로 돌아옵니다.
 exception when insufficient_privilege or raise_exception then null; end;

 -- 기록 종류를 쓰지 않는 그룹에는 값이 들어오지 못합니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,record_minutes)
  values (plain_group,member_id,'엉뚱한 값',now(),388);
  raise exception '기록하지 않는 그룹에 값 허용';
 exception when insufficient_privilege or raise_exception then null; end;

 -- 범위를 벗어난 값은 CHECK가 막습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,record_minutes)
  values (wake_group,member_id,'범위 밖',now(),1441);
  raise exception '1440분 초과 허용';
 exception when check_violation then null; end;
end $$;

-- 목표는 본인 것만, 활성 멤버만 정합니다.
do $$ begin
 perform public.set_member_goal('00000000-0000-4000-8000-00000000bb01',390);
 assert (select goal_minutes = 390 from public.group_members
  where group_id = '00000000-0000-4000-8000-00000000bb01'
    and user_id = '00000000-0000-4000-8000-00000000ba02'), '본인 목표 저장';

 -- 비워 두면 목표 없이 기록만 남깁니다.
 perform public.set_member_goal('00000000-0000-4000-8000-00000000bb01',null);
 assert (select goal_minutes is null from public.group_members
  where group_id = '00000000-0000-4000-8000-00000000bb01'
    and user_id = '00000000-0000-4000-8000-00000000ba02'), '목표 지우기';
 perform public.set_member_goal('00000000-0000-4000-8000-00000000bb01',390);

 -- 범위를 벗어난 목표는 함수가 막습니다.
 begin
  perform public.set_member_goal('00000000-0000-4000-8000-00000000bb01',1441);
  raise exception '범위 밖 목표 허용';
 exception when raise_exception then null; end;

 -- 함수가 자기 행만 고치므로 소유자의 목표는 그대로입니다.
 assert (select goal_minutes is null from public.group_members
  where group_id = '00000000-0000-4000-8000-00000000bb01'
    and user_id = '00000000-0000-4000-8000-00000000ba01'), '남의 목표는 그대로';
end $$;

-- 그룹 밖 사용자는 목표를 정할 수 없습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ba03',true);
do $$ begin
 begin
  perform public.set_member_goal('00000000-0000-4000-8000-00000000bb01',400);
  raise exception '외부인 목표 설정 허용';
 exception when insufficient_privilege then null; end;
end $$;

-- 현황판이 기록 종류와 목표, 날짜별 기록값을 함께 내려줍니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ba02',true);
do $$
declare
 overview jsonb;
begin
 overview := public.get_group_overview('00000000-0000-4000-8000-00000000bb01');
 assert overview->>'recordKind' = 'CLOCK', '현황판 기록 종류';
 assert (select (member->>'goalMinutes')::int = 390
  from jsonb_array_elements(overview->'members') as member
  where member->>'userId' = '00000000-0000-4000-8000-00000000ba02'), '현황판 목표';
 assert (select count(*) from jsonb_array_elements(overview->'members') as member,
   jsonb_array_elements(member->'days') as day
   where (day->>'recordMinutes')::int = 388) = 1, '현황판 날짜별 기록값';
end $$;

-- 비로그인에게는 목표 함수가 닫혀 있습니다.
reset role;
set local role anon;
do $$ begin
 begin
  perform public.set_member_goal('00000000-0000-4000-8000-00000000bb01',400);
  raise exception 'anon 목표 설정 허용';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select '기록 종류와 목표 접근 범위 검증 통과' as result;
