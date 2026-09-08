-- 그룹 문제 제목을 누가 쓰고 읽을 수 있는지 DB에서 확인하고 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000c1','title-owner@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c2','title-reviewer@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','title-member@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c4','title-outsider@example.invalid');
insert into public.groups(id,name,slug,owner_id) values
 ('00000000-0000-4000-8000-0000000000d1','제목 검증','problem-title-test','00000000-0000-4000-8000-0000000000c1');
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c2','REVIEWER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c3','MEMBER','ACTIVE',now());

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
set local role authenticated;
do $$ begin
 begin
  insert into public.group_problem_titles(group_id,url,title,updated_by)
  values ('00000000-0000-4000-8000-0000000000d1','https://acmicpc.net/problem/1000','멤버가 정한 제목',
   '00000000-0000-4000-8000-0000000000c3');
  raise exception '일반 멤버 제목 저장 허용';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',true);
do $$
declare blocked text;
begin
 -- 앱이 정규화한 링크만 한 행이 되도록 DB에서도 형식을 막습니다.
 foreach blocked in array array[
  'http://acmicpc.net/problem/1000',
  'https://acmicpc.net/problem/1000/',
  'https://acmicpc.net/problem/1000?lang=ko',
  'https://acmicpc.net/problem/1000#note'
 ] loop
  begin
   insert into public.group_problem_titles(group_id,url,title,updated_by)
   values ('00000000-0000-4000-8000-0000000000d1',blocked,'제목','00000000-0000-4000-8000-0000000000c2');
   raise exception '허용하면 안 되는 링크 저장: %', blocked;
  exception when check_violation then null; end;
 end loop;

 -- 남의 이름으로 기록을 남길 수 없습니다.
 begin
  insert into public.group_problem_titles(group_id,url,title,updated_by)
  values ('00000000-0000-4000-8000-0000000000d1','https://acmicpc.net/problem/1000','제목',
   '00000000-0000-4000-8000-0000000000c1');
  raise exception '다른 사람 이름으로 제목 저장 허용';
 exception when insufficient_privilege then null; end;

 insert into public.group_problem_titles(group_id,url,title,updated_by)
 values ('00000000-0000-4000-8000-0000000000d1','https://acmicpc.net/problem/1000','A+B',
  '00000000-0000-4000-8000-0000000000c2');
 update public.group_problem_titles set title='A+B 문제', updated_by='00000000-0000-4000-8000-0000000000c2'
 where group_id='00000000-0000-4000-8000-0000000000d1' and url='https://acmicpc.net/problem/1000';
 assert (select title='A+B 문제' from public.group_problem_titles
  where group_id='00000000-0000-4000-8000-0000000000d1'), '검수자 제목 수정';

 -- 같은 그룹의 같은 링크는 한 행뿐입니다.
 begin
  insert into public.group_problem_titles(group_id,url,title,updated_by)
  values ('00000000-0000-4000-8000-0000000000d1','https://acmicpc.net/problem/1000','다른 제목',
   '00000000-0000-4000-8000-0000000000c2');
  raise exception '같은 문제에 두 행 허용';
 exception when unique_violation then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
do $$ begin
 assert (select count(*)=1 from public.group_problem_titles), '활성 멤버 제목 조회';
 -- 정책이 행을 걸러 일반 멤버의 삭제는 아무 행도 지우지 못합니다.
 delete from public.group_problem_titles where group_id='00000000-0000-4000-8000-0000000000d1';
 assert (select count(*)=1 from public.group_problem_titles), '일반 멤버 제목 삭제 차단';
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c4',true);
do $$ begin
 assert (select count(*)=0 from public.group_problem_titles), '비멤버 제목 조회 차단';
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
do $$ begin
 -- 소유자는 제목을 지워 기록에 적힌 제목으로 되돌릴 수 있습니다.
 delete from public.group_problem_titles where group_id='00000000-0000-4000-8000-0000000000d1';
 assert (select count(*)=0 from public.group_problem_titles), '소유자 제목 삭제';
end $$;
reset role;
rollback;
select '역할별 제목 저장·수정·삭제 권한과 링크 형식, 그룹당 한 행 검증 통과, 테스트 데이터 롤백 완료' as result;
