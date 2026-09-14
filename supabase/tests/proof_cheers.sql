-- 응원이 남의 기록에만, 활성 멤버에게만 열리는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000c1','cheer-owner@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c2','cheer-author@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','cheer-member@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c4','cheer-outsider@example.invalid');
-- 사진 없이 기록을 만들 수 있게 사진 필수를 끕니다. 응원 규칙은 사진과 무관합니다.
insert into public.groups(id,name,slug,owner_id,requires_photo) values
 ('00000000-0000-4000-8000-0000000000d1','응원 검증','cheer-test','00000000-0000-4000-8000-0000000000c1',false);
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c2','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c3','MEMBER','ACTIVE',now());
-- 검수 대기 기록 하나와 취소 처리 중인 기록 하나. 둘 다 작성자는 c2입니다.
insert into public.proofs(id,group_id,user_id,problem_key,accepted_at,verification_status) values
 ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c2','응원 대상',now(),'PENDING'),
 ('00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c2','취소 중',now(),'CANCELING');

-- 같은 그룹의 다른 멤버는 응원을 남길 수 있습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
set local role authenticated;
do $$ begin
 insert into public.proof_cheers(proof_id,user_id)
 values ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000c3');
 assert (select count(*) from public.proof_cheers
  where proof_id='00000000-0000-4000-8000-0000000000e1') = 1, '멤버의 응원 저장';
 -- 취소 처리 중인 기록에는 남길 수 없습니다.
 begin
  insert into public.proof_cheers(proof_id,user_id)
  values ('00000000-0000-4000-8000-0000000000e2','00000000-0000-4000-8000-0000000000c3');
  raise exception '취소 중인 기록에 응원 허용';
 exception when insufficient_privilege then null; end;
 -- 남의 이름으로는 남길 수 없습니다.
 begin
  insert into public.proof_cheers(proof_id,user_id)
  values ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000c2');
  raise exception '남의 이름으로 응원 허용';
 exception when insufficient_privilege then null; end;
end $$;

-- 작성자 본인은 자기 기록에 응원할 수 없고, 남의 응원을 지울 수도 없습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',true);
do $$ begin
 begin
  insert into public.proof_cheers(proof_id,user_id)
  values ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000c2');
  raise exception '본인 기록 응원 허용';
 exception when insufficient_privilege then null; end;
 assert (select count(*) from public.proof_cheers
  where proof_id='00000000-0000-4000-8000-0000000000e1') = 1, '작성자도 응원을 봄';
 delete from public.proof_cheers where proof_id='00000000-0000-4000-8000-0000000000e1';
 assert (select count(*) from public.proof_cheers
  where proof_id='00000000-0000-4000-8000-0000000000e1') = 1, '남의 응원은 지워지지 않음';
end $$;

-- 그룹 밖 사용자에게는 보이지도 않고 남길 수도 없습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c4',true);
do $$ begin
 assert (select count(*) from public.proof_cheers) = 0, '외부인에게 응원 숨김';
 begin
  insert into public.proof_cheers(proof_id,user_id)
  values ('00000000-0000-4000-8000-0000000000e1','00000000-0000-4000-8000-0000000000c4');
  raise exception '외부인 응원 허용';
 exception when insufficient_privilege then null; end;
end $$;

-- 내가 남긴 응원은 내가 거둡니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
do $$ begin
 delete from public.proof_cheers where proof_id='00000000-0000-4000-8000-0000000000e1';
 assert (select count(*) from public.proof_cheers
  where proof_id='00000000-0000-4000-8000-0000000000e1') = 0, '본인 응원 거두기';
end $$;

-- 비로그인에게는 표 자체가 닫혀 있습니다.
reset role;
set local role anon;
do $$ begin
 begin
  perform count(*) from public.proof_cheers;
  raise exception 'anon 조회 허용';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select '응원 접근 범위 검증 통과' as result;
