-- 착석·퇴근 도장이 하루 한 구간으로 묶이는지, 누가 채울 수 있는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-00000000ca01','seat-owner@example.invalid'),
 ('00000000-0000-4000-8000-00000000ca02','seat-member@example.invalid'),
 ('00000000-0000-4000-8000-00000000ca03','seat-outsider@example.invalid');
-- 사진 필수를 켠 착석 그룹입니다. 착석 도장이 사진을 대신하는지 봅니다.
insert into public.groups(id,name,slug,owner_id,requires_photo,record_kind) values
 ('00000000-0000-4000-8000-00000000cb01','착석 검증','seat-test','00000000-0000-4000-8000-00000000ca01',true,'DURATION'),
 ('00000000-0000-4000-8000-00000000cb02','기상 검증','seat-clock-test','00000000-0000-4000-8000-00000000ca01',false,'CLOCK'),
 ('00000000-0000-4000-8000-00000000cb03','자정 넘김','seat-midnight-test','00000000-0000-4000-8000-00000000ca01',false,'DURATION');
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-00000000cb01','00000000-0000-4000-8000-00000000ca02','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-00000000cb02','00000000-0000-4000-8000-00000000ca02','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-00000000cb03','00000000-0000-4000-8000-00000000ca02','MEMBER','ACTIVE',now());

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca02',true);
set local role authenticated;
do $$
declare
 seat_group uuid := '00000000-0000-4000-8000-00000000cb01';
 clock_group uuid := '00000000-0000-4000-8000-00000000cb02';
 member_id uuid := '00000000-0000-4000-8000-00000000ca02';
begin
 -- 착석 도장은 시간이 아직 없는 기록입니다. 사진 필수를 켠 그룹에서도 통과합니다.
 insert into public.proofs(group_id,user_id,problem_key,accepted_at,start_minutes)
 values (seat_group,member_id,'착석',now(),600);
 assert (select start_minutes = 600 and record_minutes is null from public.proofs
  where group_id = seat_group), '착석 도장 저장';

 -- 하루 한 구간이라 같은 날 둘째 기록은 만들지 못합니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,start_minutes)
  values (seat_group,member_id,'두 번째 착석',now(),700);
  raise exception '같은 날 둘째 기록 허용';
 exception when raise_exception or insufficient_privilege then null; end;

 -- 착석 값은 시간을 기록하는 그룹에서만 받습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,start_minutes)
  values (clock_group,member_id,'엉뚱한 착석',now(),600);
  raise exception '시각 그룹에 착석 값 허용';
 exception when raise_exception or insufficient_privilege then null; end;
end $$;

-- 퇴근 도장을 잊은 날은 직접 적어 채웁니다.
do $$
declare
 result jsonb;
begin
 result := public.finish_seat_record('00000000-0000-4000-8000-00000000cb01',240);
 assert (result->>'recordMinutes')::int = 240, '보정 값으로 채우기';
 assert (result->>'startMinutes')::int = 600, '착석 시각 유지';
 assert (select record_minutes = 240 from public.proofs
  where group_id = '00000000-0000-4000-8000-00000000cb01'), '기록에 시간 반영';

 -- 이미 끝난 기록은 다시 채우지 못합니다.
 begin
  perform public.finish_seat_record('00000000-0000-4000-8000-00000000cb01');
  raise exception '끝난 기록 재채움 허용';
 exception when insufficient_privilege then null; end;

 -- 범위를 벗어난 보정은 막습니다.
 begin
  perform public.finish_seat_record('00000000-0000-4000-8000-00000000cb01',1441);
  raise exception '범위 밖 보정 허용';
 exception when raise_exception then null; end;
end $$;

-- 자정을 넘겨 앉아 있었어도 시간이 음수가 되지 않습니다.
do $$
declare
 result jsonb;
 duration integer;
begin
 insert into public.proofs(group_id,user_id,problem_key,accepted_at,start_minutes)
 values ('00000000-0000-4000-8000-00000000cb03','00000000-0000-4000-8000-00000000ca02','늦은 착석',now(),1400);
 result := public.finish_seat_record('00000000-0000-4000-8000-00000000cb03');
 duration := (result->>'recordMinutes')::int;
 assert duration > 0 and duration <= 1440, '자정을 넘겨도 양수';
end $$;

-- 시각을 기록하는 그룹에서는 퇴근 도장을 쓰지 않습니다.
do $$ begin
 begin
  perform public.finish_seat_record('00000000-0000-4000-8000-00000000cb02');
  raise exception '시각 그룹에 퇴근 도장 허용';
 exception when insufficient_privilege then null; end;
end $$;

-- 그룹 밖 사용자는 남의 기록을 채우지 못합니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca03',true);
do $$ begin
 begin
  perform public.finish_seat_record('00000000-0000-4000-8000-00000000cb01');
  raise exception '외부인 퇴근 도장 허용';
 exception when insufficient_privilege then null; end;
end $$;

-- 현황판이 착석 시각을 함께 내려줍니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ca02',true);
do $$
declare
 overview jsonb;
begin
 overview := public.get_group_overview('00000000-0000-4000-8000-00000000cb01');
 assert overview->>'recordKind' = 'DURATION', '현황판 기록 종류';
 assert (select count(*) from jsonb_array_elements(overview->'members') as member,
   jsonb_array_elements(member->'days') as day
   where (day->>'startMinutes')::int = 600
     and (day->>'recordMinutes')::int = 240) = 1, '현황판 착석 시각과 시간';
end $$;

-- 비로그인에게는 퇴근 도장 함수가 닫혀 있습니다.
reset role;
set local role anon;
do $$ begin
 begin
  perform public.finish_seat_record('00000000-0000-4000-8000-00000000cb01');
  raise exception 'anon 퇴근 도장 허용';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select '착석·퇴근 도장 검증 통과' as result;
