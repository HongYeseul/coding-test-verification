-- 자동 인정 설정에 따라 어떤 상태로 기록이 만들어지고 누가 되돌릴 수 있는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000e1','auto-owner@example.invalid'),
 ('00000000-0000-4000-8000-0000000000e2','auto-reviewer@example.invalid'),
 ('00000000-0000-4000-8000-0000000000e3','auto-member@example.invalid'),
 ('00000000-0000-4000-8000-0000000000e4','auto-bystander@example.invalid');
insert into public.groups(id,name,slug,owner_id,auto_approve) values
 ('00000000-0000-4000-8000-0000000000f1','자동 인정','auto-approve-test','00000000-0000-4000-8000-0000000000e1',true),
 ('00000000-0000-4000-8000-0000000000f2','수동 검수','manual-review-test','00000000-0000-4000-8000-0000000000e1',false);
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000e2','REVIEWER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000e3','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000e4','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8000-0000000000e3','MEMBER','ACTIVE',now());
insert into storage.objects(bucket_id,name,metadata) values
 ('proof-evidence','00000000-0000-4000-8000-0000000000f1/00000000-0000-4000-8000-0000000000e3/00000000-0000-4000-8000-0000000000a1.png','{"mimetype":"image/png","size":1000}'),
 ('proof-evidence','00000000-0000-4000-8000-0000000000f1/00000000-0000-4000-8000-0000000000e3/00000000-0000-4000-8000-0000000000a2.png','{"mimetype":"image/png","size":1000}'),
 ('proof-evidence','00000000-0000-4000-8000-0000000000f2/00000000-0000-4000-8000-0000000000e3/00000000-0000-4000-8000-0000000000a3.png','{"mimetype":"image/png","size":1000}');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e3',true);
set local role authenticated;
do $$
declare
 auto_group uuid := '00000000-0000-4000-8000-0000000000f1';
 manual_group uuid := '00000000-0000-4000-8000-0000000000f2';
 member_id uuid := '00000000-0000-4000-8000-0000000000e3';
begin
 -- 자동 인정이 꺼진 그룹에서는 브라우저가 직접 요청해도 인정 상태로 들어올 수 없습니다.
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,evidence_path,verification_status)
  values (manual_group,member_id,'몰래 인정',now(),
   manual_group::text||'/'||member_id::text||'/00000000-0000-4000-8000-0000000000a3.png','AUTO_APPROVED');
  raise exception '설정이 꺼진 그룹에서 자동 인정 허용';
 exception when insufficient_privilege then null; end;

 insert into public.proofs(group_id,user_id,problem_key,accepted_at,evidence_path,verification_status)
 values (manual_group,member_id,'검수 대기',now(),
  manual_group::text||'/'||member_id::text||'/00000000-0000-4000-8000-0000000000a3.png','PENDING');

 -- 자동 인정 그룹에서는 등록하는 순간 인정으로 시작합니다.
 insert into public.proofs(id,group_id,user_id,problem_key,accepted_at,evidence_path,verification_status)
 values ('00000000-0000-4000-8000-0000000000b1',auto_group,member_id,'반려 대상',now(),
  auto_group::text||'/'||member_id::text||'/00000000-0000-4000-8000-0000000000a1.png','AUTO_APPROVED');
 insert into public.proofs(id,group_id,user_id,problem_key,accepted_at,evidence_path,verification_status)
 values ('00000000-0000-4000-8000-0000000000b2',auto_group,member_id,'취소 대상',now(),
  auto_group::text||'/'||member_id::text||'/00000000-0000-4000-8000-0000000000a2.png','AUTO_APPROVED');
end $$;

-- 같은 그룹의 일반 멤버는 반려할 수 없습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e4',true);
do $$ begin
 begin
  insert into public.proof_reviews(proof_id,reviewer_id,decision,note)
  values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000e4','REJECTED','신고');
  raise exception '일반 멤버 반려 허용';
 exception when insufficient_privilege then null; end;
end $$;

-- 검수자는 자동 인정된 기록을 반려해 미인정으로 내릴 수 있습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e2',true);
do $$ begin
 insert into public.proof_reviews(proof_id,reviewer_id,decision,note)
 values ('00000000-0000-4000-8000-0000000000b1','00000000-0000-4000-8000-0000000000e2','REJECTED','문제 화면이 아님');
 assert (select verification_status='REJECTED' from public.proofs
  where id='00000000-0000-4000-8000-0000000000b1'), '자동 인정 기록 반려';
end $$;

-- 자동 인정은 즉시 인정이므로 잘못 올린 사진을 본인이 취소할 수 있어야 합니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000e3',true);
do $$ begin
 assert public.begin_proof_cancellation(
  '00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000b2') is not null,
  '자동 인정 기록 취소 시작';
 assert (select verification_status='CANCELING' from public.proofs
  where id='00000000-0000-4000-8000-0000000000b2'), '취소 처리 중 전환';
 -- 반려된 기록은 본인도 취소할 수 없습니다.
 begin
  perform public.begin_proof_cancellation(
   '00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000b1');
  raise exception '반려된 기록 취소 허용';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select '자동 인정 등록·반려 권한·본인 취소 검증 통과, 테스트 데이터 롤백 완료' as result;
