-- postgres 역할로 실행합니다. 사용자와 인증 기록은 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-000000000091','overview-owner@example.invalid'),
 ('00000000-0000-4000-8000-000000000092','overview-member@example.invalid'),
 ('00000000-0000-4000-8000-000000000093','overview-pending@example.invalid');
insert into public.groups(id,name,slug,owner_id,created_at) values
 ('00000000-0000-4000-8000-000000000081','현황판 검증','overview-test','00000000-0000-4000-8000-000000000091',now()-interval '60 days'),
 ('00000000-0000-4000-8000-000000000082','다른 그룹','overview-other-test','00000000-0000-4000-8000-000000000091',now());
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
insert into storage.objects(bucket_id,name,metadata) values
 ('proof-evidence','00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000092/00000000-0000-4000-8000-000000000061.webp','{"mimetype":"image/webp","size":1024}');
insert into public.proofs(id,group_id,user_id,problem_key,evidence_path,accepted_at,created_at,verification_status) values
 ('00000000-0000-4000-8000-000000000061','00000000-0000-4000-8000-000000000081','00000000-0000-4000-8000-000000000092','photo-proof','00000000-0000-4000-8000-000000000081/00000000-0000-4000-8000-000000000092/00000000-0000-4000-8000-000000000061.webp',now(),now(),'PENDING');
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
 assert (member->>'pending')::int=2,'검수 대기 별도 집계';
 assert (member->>'todaySubmitted')::int=3+case when today=week_start then 1 else 0 end,'반려 제외한 오늘 참여';
 assert member->>'featuredProofId'='00000000-0000-4000-8000-000000000061','이번 주 첫 사진 대표 인증';
 assert member->>'featuredDate'=today::text,'대표 사진 등록일';
 assert owner->>'featuredProofId' is null and owner->>'featuredDate' is null,'사진 없는 멤버 대표 인증 없음';
 assert (owner->>'totalApproved')::int=0 and (owner->>'pending')::int=0,'기록 없는 멤버도 0건 표시';
 assert jsonb_array_length(owner->'days')=7,'기록 없는 멤버의 달력';
 select value into day from jsonb_array_elements(member->'days') where value->>'date'=today::text;
 assert (day->>'approved')::int=1+case when today=week_start then 1 else 0 end;
 assert (day->>'pending')::int=2 and (day->>'rejected')::int=1,'일별 상태 구분';
end $$;
do $$ declare overview jsonb; member jsonb;
 week_start date := date_trunc('week',now() at time zone 'Asia/Seoul')::date;
 group_week date := date_trunc('week',(now()-interval '60 days') at time zone 'Asia/Seoul')::date;
begin
 -- 지난주는 주 경계 직전 기록만 집계하고 이번 주 기록은 제외합니다.
 overview := public.get_group_overview('00000000-0000-4000-8000-000000000081', week_start-7);
 assert overview->>'weekStart'=(week_start-7)::text,'지난주 조회';
 assert overview->>'weekEnd'=(week_start-1)::text,'주 마지막 날';
 assert overview->>'currentWeekStart'=week_start::text,'이번 주 기준일';
 assert overview->>'firstWeekStart'=group_week::text,'그룹 생성 주';
 assert overview->'days'->>0=(week_start-7)::text,'지난주 달력 시작';
 select value into member from jsonb_array_elements(overview->'members') where value->>'userId'='00000000-0000-4000-8000-000000000092';
 assert (member->>'weekApproved')::int=1,'주 경계 직전 기록만 지난주 집계';
 assert (select sum((entry->>'approved')::int) from jsonb_array_elements(member->'days') entry)=1,'지난주 달력에서 이번 주 기록 제외';
 assert (member->>'totalApproved')::int=1108,'누적 승인은 조회한 주와 무관';
 assert (member->>'pending')::int=2,'검수 대기는 조회한 주와 무관';
 assert member->>'featuredProofId' is null,'다른 주 사진은 대표로 쓰지 않음';

 -- 2주 전 기록은 그 주에서만 보입니다.
 overview := public.get_group_overview('00000000-0000-4000-8000-000000000081', week_start-14);
 select value into member from jsonb_array_elements(overview->'members') where value->>'userId'='00000000-0000-4000-8000-000000000092';
 assert (member->>'weekApproved')::int=1105,'2주 전 승인 집계';

 -- 주 중간 날짜는 그 주 월요일로 맞춥니다.
 assert public.get_group_overview('00000000-0000-4000-8000-000000000081', week_start-11)->>'weekStart'=(week_start-14)::text,'월요일 정규화';
 -- 아직 오지 않은 주와 그룹 생성 이전 주는 볼 수 있는 범위로 되돌립니다.
 assert public.get_group_overview('00000000-0000-4000-8000-000000000081', week_start+7)->>'weekStart'=week_start::text,'미래 주 차단';
 assert public.get_group_overview('00000000-0000-4000-8000-000000000081', group_week-70)->>'weekStart'=group_week::text,'그룹 생성 주로 제한';
 assert public.get_group_overview('00000000-0000-4000-8000-000000000081', null)->>'weekStart'=week_start::text,'인자 없이 이번 주';
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
select '현황판 전체 집계·주간 이동 경계·권한 검증 통과, 테스트 데이터 롤백 완료' as result;
