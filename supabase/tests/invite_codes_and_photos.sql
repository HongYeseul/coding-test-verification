-- SQL Editor에서 postgres 역할로 실행합니다. 테스트 데이터는 모두 롤백합니다.
begin;
insert into auth.users (id, email) values
 ('00000000-0000-4000-8000-000000000011', 'photo-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000012', 'photo-member@example.invalid'),
 ('00000000-0000-4000-8000-000000000013', 'photo-other@example.invalid');
insert into public.groups (id, name, slug, owner_id) values
 ('00000000-0000-4000-8000-000000000021', '검증 그룹', 'photo-flow-test', '00000000-0000-4000-8000-000000000011');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
set local role authenticated;
select public.rotate_group_invite_code('00000000-0000-4000-8000-000000000021', 'ZYX98');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
do $$ begin
 assert public.join_group_by_code('zyx98')->>'status' = 'PENDING';
 assert public.join_group_by_code('ZYX98')->>'status' = 'PENDING';
 assert (select count(*) = 0 from public.groups), '승인 전 그룹 조회 차단';
 assert (select count(*) = 0 from public.group_invite_codes), '비소유자 코드 조회 차단';
 begin
  perform public.rotate_group_invite_code('00000000-0000-4000-8000-000000000021', 'ZYX97');
  raise exception '비소유자 코드 변경 허용';
 exception when raise_exception then
  if sqlerrm = '비소유자 코드 변경 허용' then raise; end if;
 end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true);
do $$ begin
 assert public.join_group_by_code('ZYX98')->>'status' = 'PENDING', '공유 코드 다인 사용';
 for i in 1..4 loop
  assert public.join_group_by_code('ZYX96')->>'status' = 'INVALID';
 end loop;
 assert public.join_group_by_code('ZYX98')->>'status' = 'RATE_LIMITED';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select public.approve_group_member('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000012');
select public.rotate_group_invite_code('00000000-0000-4000-8000-000000000021', 'ZYX97');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
do $$ begin
 assert public.join_group_by_code('ZYX98')->>'status' = 'INVALID', '이전 코드 만료';
 assert public.join_group_by_code('ZYX97')->>'status' = 'ACTIVE';
end $$;
reset role;
-- Storage HTTP 업로드와 별개로 DB 경로·MIME·RLS 계약을 검증하는 메타데이터입니다.
insert into storage.objects (bucket_id, name, metadata) values ('proof-evidence',
 '00000000-0000-4000-8000-000000000021/00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000031.png',
 '{"mimetype":"image/png","size":1024}');
set local role authenticated;
insert into public.proofs (id, group_id, user_id, problem_key, accepted_at, evidence_path) values
 ('00000000-0000-4000-8000-000000000041', '00000000-0000-4000-8000-000000000021',
 '00000000-0000-4000-8000-000000000012', 'photo-test', now(),
 '00000000-0000-4000-8000-000000000021/00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000031.png');
do $$ begin
 assert (select verification_status = 'PENDING' and platform_account_id is null from public.proofs where id = '00000000-0000-4000-8000-000000000041');
 assert not private.can_delete_evidence_path('00000000-0000-4000-8000-000000000021/00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000031.png');
 begin
  insert into public.proofs(group_id,user_id,problem_key,accepted_at,evidence_path) values
   ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000012','missing',now(),
   '00000000-0000-4000-8000-000000000021/00000000-0000-4000-8000-000000000012/missing.png');
  raise exception '없는 사진 제출 허용';
 exception when raise_exception then
  if sqlerrm = '없는 사진 제출 허용' then raise; end if;
 end;
 begin
  insert into public.proof_reviews(proof_id,reviewer_id,decision) values
   ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000012','APPROVED');
  raise exception '자기 검수 허용';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
insert into public.proof_reviews(proof_id,reviewer_id,decision) values
 ('00000000-0000-4000-8000-000000000041','00000000-0000-4000-8000-000000000011','APPROVED');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
do $$ declare removed integer; begin
 assert (select verification_status = 'MANUAL_REVIEWED' from public.proofs where id = '00000000-0000-4000-8000-000000000041');
 delete from public.proofs where id = '00000000-0000-4000-8000-000000000041';
 get diagnostics removed = row_count;
 assert removed = 0, '검수된 기록 삭제 차단';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', true);
do $$ begin
 assert (select count(*) = 0 from public.proofs), 'PENDING 멤버 사진 조회 차단';
 assert not private.can_read_evidence_path('00000000-0000-4000-8000-000000000021/00000000-0000-4000-8000-000000000012/00000000-0000-4000-8000-000000000031.png');
end $$;
reset role;
rollback;
select '초대코드·사진·권한 검증 통과, 테스트 데이터 롤백 완료' as result;
