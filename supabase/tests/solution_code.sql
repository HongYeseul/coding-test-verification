-- 풀이 코드가 사진을 대신할 수 있는지, 그리고 길이 제한이 지켜지는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000f01','code-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000f02','code-member@example.invalid');
insert into public.groups(id,name,slug,owner_id,requires_photo,is_coding_study) values
 ('00000000-0000-4000-8000-000000000f11','코드 스터디','code-study-test','00000000-0000-4000-8000-000000000f01',true,true);
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-000000000f11','00000000-0000-4000-8000-000000000f02','MEMBER','ACTIVE',now());

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000f02',true);
set local role authenticated;
do $$
declare
 study uuid := '00000000-0000-4000-8000-000000000f11';
 member_id uuid := '00000000-0000-4000-8000-000000000f02';
begin
 -- 사진 필수 그룹이라도 풀이 코드를 남기면 사진 없이 등록됩니다.
 insert into public.proofs(group_id,user_id,problem_key,problem_title,accepted_at,solution_code)
 values (study,member_id,'00000000-0000-4000-8000-000000000f21','더 맵게',now(),'def solution(): return 0');

 -- 사진도 코드도 없으면 여전히 막습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at)
  values (study,member_id,'00000000-0000-4000-8000-000000000f22',now());
  raise exception '근거 없는 기록 허용';
 exception when insufficient_privilege or raise_exception then null; end;

 -- 같은 열쇠로 재시도해도 기록은 하나만 남습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,solution_code)
  values (study,member_id,'00000000-0000-4000-8000-000000000f21',now(),'def solution(): return 0');
  raise exception '코드 기록의 재시도 중복 허용';
 exception when unique_violation then null; end;

 -- 2만 자를 넘는 코드는 받지 않습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,solution_code)
  values (study,member_id,'00000000-0000-4000-8000-000000000f23',now(),repeat('a',20001));
  raise exception '길이 제한 초과 허용';
 exception when check_violation then null; end;
end $$;
reset role;
rollback;
select '코드가 사진을 대신하고 길이·중복 제한이 지켜짐, 테스트 데이터 롤백 완료' as result;
