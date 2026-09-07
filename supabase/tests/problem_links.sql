-- 브라우저가 직접 INSERT해도 문제 링크 형식을 DB에서 막는지 확인하고 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000091','link-owner@example.invalid');
insert into public.groups(id,name,slug,owner_id) values
 ('00000000-0000-4000-8000-0000000000a1','문제 링크 검증','problem-link-test','00000000-0000-4000-8000-000000000091');
insert into storage.objects(bucket_id,name,metadata) values
 ('proof-evidence','00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000091/00000000-0000-4000-8000-0000000000b1.png','{"mimetype":"image/png","size":1000}');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
set local role authenticated;
do $$
declare
 path text := '00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-000000000091/00000000-0000-4000-8000-0000000000b1.png';
 blocked text;
begin
 foreach blocked in array array[
  'http://acmicpc.net/problem/1000',
  'javascript:alert(1)',
  'https://acmicpc.net/problem/' || repeat('a', 500)
 ] loop
  begin
   insert into public.proofs(group_id,user_id,problem_key,problem_url,accepted_at,evidence_path)
   values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000091','link',blocked,now(),path);
   raise exception '허용하면 안 되는 문제 링크 저장: %', blocked;
  exception when check_violation then null; end;
 end loop;

 insert into public.proofs(group_id,user_id,problem_key,problem_url,accepted_at,evidence_path)
 values ('00000000-0000-4000-8000-0000000000a1','00000000-0000-4000-8000-000000000091','link',
  'https://acmicpc.net/problem/1000',now(),path);
 assert (select count(*)=1 from public.proofs
  where group_id='00000000-0000-4000-8000-0000000000a1' and problem_url='https://acmicpc.net/problem/1000');
end $$;
reset role;
rollback;
select 'https 아닌 링크·과도한 길이 차단과 정상 링크 저장 검증 통과, 테스트 데이터 롤백 완료' as result;
