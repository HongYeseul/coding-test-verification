-- 사진 필수·코딩 테스트 설정이 등록을 어떻게 가르는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000c1','settings-owner@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c2','settings-reviewer@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','settings-member@example.invalid');
insert into public.groups(id,name,slug,owner_id,requires_photo) values
 ('00000000-0000-4000-8000-0000000000d1','사진 필수','photo-required-test','00000000-0000-4000-8000-0000000000c1',true),
 ('00000000-0000-4000-8000-0000000000d2','사진 선택','photo-optional-test','00000000-0000-4000-8000-0000000000c1',false);
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c2','REVIEWER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c3','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000c2','REVIEWER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000c3','MEMBER','ACTIVE',now());

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
set local role authenticated;
do $$
declare
 required_group uuid := '00000000-0000-4000-8000-0000000000d1';
 optional_group uuid := '00000000-0000-4000-8000-0000000000d2';
 member_id uuid := '00000000-0000-4000-8000-0000000000c3';
begin
 -- 사진 필수 그룹에는 브라우저에서 직접 요청해도 사진 없는 기록이 들어오지 않습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at)
  values (required_group,member_id,'00000000-0000-4000-8000-0000000000a9',now());
  raise exception '사진 필수 그룹에 사진 없는 기록 허용';
 exception when insufficient_privilege or raise_exception then null; end;

 -- 사진 필수를 끈 그룹에서는 사진 없이 한 줄 메모만으로 등록합니다.
 insert into public.proofs(id,group_id,user_id,problem_key,problem_title,accepted_at)
 values ('00000000-0000-4000-8000-0000000000b5',optional_group,member_id,
  '00000000-0000-4000-8000-0000000000a5','6시 기상',now());

 -- 응답이 유실돼 같은 열쇠로 재시도해도 기록은 하나만 남습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at)
  values (optional_group,member_id,'00000000-0000-4000-8000-0000000000a5',now());
  raise exception '사진 없는 기록의 재시도 중복 허용';
 exception when unique_violation then null; end;
end $$;

-- 사진 필수를 다시 켜도 이미 등록된 기록의 검수는 막히지 않습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
do $$ begin
 update public.groups set requires_photo = true
 where id = '00000000-0000-4000-8000-0000000000d2';
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',true);
do $$ begin
 insert into public.proof_reviews(proof_id,reviewer_id,decision,note)
 values ('00000000-0000-4000-8000-0000000000b5','00000000-0000-4000-8000-0000000000c2','APPROVED','확인');
 assert (select verification_status='MANUAL_REVIEWED' from public.proofs
  where id='00000000-0000-4000-8000-0000000000b5'), '사진 없는 기록 승인';
end $$;

-- 그룹을 만들 때 고른 코딩 테스트 여부가 그대로 저장되고 사진 필수는 기본값입니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
do $$
declare
 coding_group uuid;
 plain_group uuid;
begin
 coding_group := public.create_group('코딩 스터디','coding-study-test',true);
 plain_group := public.create_group('기상 스터디','wake-up-study-test',false);
 assert (select is_coding_study and requires_photo from public.groups where id=coding_group),
  '코딩 테스트 스터디 생성';
 assert (select not is_coding_study and requires_photo from public.groups where id=plain_group),
  '코딩 테스트가 아닌 스터디 생성';
end $$;
reset role;
rollback;
select '사진 필수 차단·사진 없는 등록·재시도 멱등성·설정 반영 검증 통과, 테스트 데이터 롤백 완료' as result;
