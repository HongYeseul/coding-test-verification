-- postgres 역할로 실행합니다. 사용자와 인증 기록은 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000091','overview-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000092','overview-member@example.invalid'),
 ('00000000-0000-4000-8000-000000000093','overview-pending@example.invalid');
insert into public.groups(id,name,slug,owner_id) values
 ('00000000-0000-4000-8000-000000000081','현황판 검증','overview-test','00000000-0000-4000-8000-000000000091'),
 ('00000000-0000-4000-8000-000000000082','다른 그룹','overview-other-test','00000000-0000-4000-8000-000000000091');
insert into public.group_members(group_id,user_id,role,status) values
 ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000092','MEMBER','ACTIVE'),
 ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000093','MEMBER','PENDING');
insert into public.platform_accounts(id,user_id,platform,handle) values
 ('00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000092','CODEFORCES','overview-member'),
 ('00000000-0000-4000-8000-000000000072','00000000-0000-4000-8000-000000000093','CODEFORCES','overview-pending');
insert into public.proofs(group_id,user_id,platform_account_id,problem_key,problem_url,accepted_at,created_at,verification_status)
select '00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000071',
 'old-'||n,'https://example.invalid',now(),(date_trunc('week',now() at time zone 'Asia/Seoul')-interval '14 days') at time zone 'Asia/Seoul','MANUAL_REVIEWED'
from generate_series(1,1105) n;
insert into public.proofs(group_id,user_id,platform_account_id,problem_key,problem_url,accepted_at,created_at,verification_status)
select '00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000071',
 item.key,'https://example.invalid',now(),item.created_at,item.status
from (values
 ('boundary-before',(date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')-interval '1 second','API_VERIFIED'),
 ('boundary-after',date_trunc('week',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul','API_VERIFIED'),
 ('today-approved',now(),'MANUAL_REVIEWED'),
 ('today-pending',now(),'PENDING'),
 ('today-rejected',now(),'REJECTED')
) item(key,created_at,status);
insert into public.proofs(group_id,user_id,platform_account_id,problem_key,problem_url,accepted_at,created_at,verification_status) values
 ('00000000-0000-4000-8000-000000000082','00000000-0000-4000-8000-000000000092','00000000-0000-4000-8000-000000000071','other-group','https://example.invalid',now(),now(),'MANUAL_REVIEWED'),
 ('00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000093','00000000-0000-4000-8000-000000000072','pending-member','https://example.invalid',now(),now(),'MANUAL_REVIEWED');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000091',true);
set local role authenticated;
do $$ declare overview jsonb; member jsonb; owner jsonb; day jsonb; today date := (now() at time zone 'Asia/Seoul')::date;
 week_start date := date_trunc('week',now() at time zone 'Asia/Seoul')::date;
begin
 overview := public.get_group_overview('00000000-0000-4000-8000-000000000081');
 assert jsonb_array_length(overview->'members')=2,'활성 멤버만 집계';
 assert jsonb_array_length(overview->'days')=7,'주간 7일';
 assert overview->>'today'=today::text,'한국 날짜';
 assert overview->>'weekStart'=week_start::text,'한국 월요일';
 select value into member from jsonb_array_elements(overview->'members') where value->>'userId'='00000000-0000-4000-8000-000000000092';
 select value into owner from jsonb_array_elements(overview->'members') where value->>'userId'='00000000-0000-4000-8000-000000000091';
 assert (member->>'totalApproved')::int=1108,'50개/1000개 제한 없이 승인 전체 집계 및 타 그룹 제외';
 assert (member->>'weekApproved')::int=2,'한국 주간 경계';
 assert (member->>'pending')::int=1,'검수 대기 별도 집계';
 assert (member->>'todaySubmitted')::int=2+case when today=week_start then 1 else 0 end,'반려 제외한 오늘 참여';
 assert (owner->>'totalApproved')::int=0 and (owner->>'pending')::int=0,'기록 없는 멤버도 0건 표시';
 assert jsonb_array_length(owner->'days')=7,'기록 없는 멤버의 달력';
 select value into day from jsonb_array_elements(member->'days') where value->>'date'=today::text;
 assert (day->>'approved')::int=1+case when today=week_start then 1 else 0 end;
 assert (day->>'pending')::int=1 and (day->>'rejected')::int=1,'일별 상태 구분';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
do $$ begin
 assert jsonb_array_length(public.get_group_overview('00000000-0000-4000-8000-000000000081')->'members')=2;
 begin
  perform public.get_group_overview('00000000-0000-4000-8000-000000000082');
  raise exception '다른 그룹 접근 허용';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000093',true);
do $$ begin
 begin
  perform public.get_group_overview('00000000-0000-4000-8000-000000000081');
  raise exception '가입 대기 접근 허용';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.group_members set status='REVOKED' where group_id='00000000-0000-4000-8000-000000000081' and user_id='00000000-0000-4000-8000-000000000092';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000092',true);
set local role authenticated;
do $$ begin
 begin
  perform public.get_group_overview('00000000-0000-4000-8000-000000000081');
  raise exception '탈퇴 멤버 접근 허용';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.get_group_overview('00000000-0000-4000-8000-000000000081');
  raise exception '비로그인 접근 허용';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select '현황판 전체 집계·주간 경계·권한 검증 통과, 테스트 데이터 롤백 완료' as result;
