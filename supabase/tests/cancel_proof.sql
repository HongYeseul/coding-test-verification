-- Storage API 완료 상태는 메타데이터 경로 변경으로 모사하고 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000051','cancel-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000052','cancel-reviewer@example.invalid');
insert into public.groups(id,name,slug,owner_id) values
 ('00000000-0000-4000-8000-000000000061','취소 검증','cancel-proof-test','00000000-0000-4000-8000-000000000051');
insert into public.group_members(group_id,user_id,role,status) values
 ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000052','REVIEWER','ACTIVE');
insert into storage.objects(bucket_id,name,metadata) values
 ('proof-evidence','00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000051/00000000-0000-4000-8000-000000000071.png','{"mimetype":"image/png","size":1000}');
insert into public.proofs(id,group_id,user_id,problem_key,accepted_at,evidence_path) values
 ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000051','cancel-photo',now(),
 '00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000051/00000000-0000-4000-8000-000000000071.png');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000052',true);
set local role authenticated;
do $$ begin
 assert public.begin_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081') is null,'다른 작성자의 기록 취소 차단';
 assert (select verification_status='PENDING' from public.proofs where id='00000000-0000-4000-8000-000000000081');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000051',true);
do $$ declare path text := '00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000051/00000000-0000-4000-8000-000000000071.png'; begin
 assert not private.can_delete_evidence_path(path),'취소 시작 전 사진 삭제 차단';
 assert public.begin_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081')->>'evidence_path'=path;
 assert public.begin_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081')->>'evidence_path'=path,'반복 취소의 재시도 경로 유지';
 assert (select verification_status='CANCELING' from public.proofs where id='00000000-0000-4000-8000-000000000081');
 assert private.can_delete_evidence_path(path),'취소 중 사진 삭제 허용';
 assert not private.can_write_evidence_path(path),'취소 중 사진 교체 차단';
 assert not exists (select 1 from jsonb_array_elements(public.get_group_overview('00000000-0000-4000-8000-000000000061')->'members') row where (row->>'pending')::int<>0 or (row->>'todaySubmitted')::int<>0),'현황판에서 취소 제외';
 begin
  perform public.finish_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081');
  raise exception '사진이 남았는데 기록 삭제 허용';
 exception when raise_exception then if sqlerrm='사진이 남았는데 기록 삭제 허용' then raise; end if; end;
 assert (select count(*)=1 from public.proofs where id='00000000-0000-4000-8000-000000000081'),'사진 실패 후 재시도 기록 보존';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000052',true);
do $$ begin
 begin
  insert into public.proof_reviews(proof_id,reviewer_id,decision) values
   ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000052','APPROVED');
  raise exception '취소 시작 후 검수 허용';
 exception when insufficient_privilege then null; end;
 assert not private.can_delete_evidence_path('00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000051/00000000-0000-4000-8000-000000000071.png');
end $$;
reset role;
update storage.objects set name=name||'.deleted-test'
where bucket_id='proof-evidence' and name='00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000051/00000000-0000-4000-8000-000000000071.png';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000051',true);
set local role authenticated;
select public.finish_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081');
select public.finish_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081');
do $$ begin
 assert (select count(*)=0 from public.proofs where id='00000000-0000-4000-8000-000000000081');
 assert public.begin_proof_cancellation('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081') is null,'완료 후 재취소 성공';
end $$;
reset role;
rollback;
select '취소 재시도·사진 삭제 선행·검수 충돌·작성자 권한 검증 통과, 테스트 데이터 롤백 완료' as result;
