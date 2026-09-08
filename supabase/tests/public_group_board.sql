-- 로그인하지 않은 방문자에게 무엇이 보이고 무엇이 막히는지 확인하고 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000c9','public-owner@example.invalid'),
 ('00000000-0000-4000-8000-0000000000ca','public-member@example.invalid');
update public.profiles set display_name='공개멤버', github_login='public-member'
 where id='00000000-0000-4000-8000-0000000000ca';
insert into public.groups(id,name,slug,owner_id,is_public) values
 ('00000000-0000-4000-8000-0000000000d9','공개 스터디','public-board-test','00000000-0000-4000-8000-0000000000c9',true),
 ('00000000-0000-4000-8000-0000000000da','비공개 스터디','private-board-test','00000000-0000-4000-8000-0000000000c9',false);
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-0000000000d9','00000000-0000-4000-8000-0000000000ca','MEMBER','ACTIVE',now()),
 ('00000000-0000-4000-8000-0000000000da','00000000-0000-4000-8000-0000000000ca','MEMBER','ACTIVE',now());
insert into storage.objects(bucket_id,name,metadata) values
 ('proof-evidence','00000000-0000-4000-8000-0000000000d9/00000000-0000-4000-8000-0000000000ca/00000000-0000-4000-8000-0000000000c1.png','{"mimetype":"image/png","size":1000}'),
 ('proof-evidence','00000000-0000-4000-8000-0000000000d9/00000000-0000-4000-8000-0000000000ca/00000000-0000-4000-8000-0000000000c2.png','{"mimetype":"image/png","size":1000}'),
 ('proof-evidence','00000000-0000-4000-8000-0000000000d9/00000000-0000-4000-8000-0000000000ca/00000000-0000-4000-8000-0000000000c3.png','{"mimetype":"image/png","size":1000}');
insert into public.proofs(group_id,user_id,problem_key,accepted_at,evidence_path,verification_status,problem_url) values
 ('00000000-0000-4000-8000-0000000000d9','00000000-0000-4000-8000-0000000000ca','승인',now(),
  '00000000-0000-4000-8000-0000000000d9/00000000-0000-4000-8000-0000000000ca/00000000-0000-4000-8000-0000000000c1.png',
  'MANUAL_REVIEWED','https://acmicpc.net/problem/1000'),
 ('00000000-0000-4000-8000-0000000000d9','00000000-0000-4000-8000-0000000000ca','자동 인정',now(),
  '00000000-0000-4000-8000-0000000000d9/00000000-0000-4000-8000-0000000000ca/00000000-0000-4000-8000-0000000000c2.png',
  'AUTO_APPROVED',null),
 ('00000000-0000-4000-8000-0000000000d9','00000000-0000-4000-8000-0000000000ca','반려',now(),
  '00000000-0000-4000-8000-0000000000d9/00000000-0000-4000-8000-0000000000ca/00000000-0000-4000-8000-0000000000c3.png',
  'REJECTED',null);

set local role anon;
do $$
declare
 board jsonb;
 leader jsonb;
 directory jsonb;
begin
 -- 비공개 그룹은 리더보드를 열어주지 않습니다.
 assert public.get_public_group_board('private-board-test') is null, '비공개 그룹 리더보드 차단';
 assert public.get_public_group_board('없는-그룹') is null, '없는 그룹 처리';

 board := public.get_public_group_board('public-board-test');
 assert board->>'name' = '공개 스터디', '공개 그룹 이름';
 -- 소유자와 멤버 두 명입니다.
 assert (board->>'memberCount')::int = 2, '공개 그룹 인원수';

 select element into leader
 from jsonb_array_elements(board->'members') element
 where element->>'displayName' = '공개멤버';
 -- 승인과 자동 인정만 세고 반려는 빼야 합니다.
 assert (leader->>'totalApproved')::int = 2, '누적 인정 집계';
 assert (leader->>'weekApproved')::int = 2, '주간 인정 집계';
 -- 닉네임과 집계 외에는 내보내지 않습니다.
 assert not (leader ? 'githubLogin'), 'GitHub 아이디 비공개';
 assert not (leader ? 'bio'), '한 줄 소개 비공개';
 assert not (leader ? 'userId'), '사용자 식별자 비공개';
 assert not (board ? 'problems'), '문제 링크 비공개';

 -- 목록에는 비공개 그룹도 이름과 인원수까지 나옵니다.
 directory := public.list_group_directory();
 assert exists (
  select 1 from jsonb_array_elements(directory) entry
  where entry->>'slug' = 'private-board-test'
    and (entry->>'isPublic')::boolean = false
    and (entry->>'memberCount')::int = 2
 ), '비공개 그룹 목록 노출';

 -- 표는 계속 잠겨 있어야 합니다. 함수가 유일한 공개 통로입니다.
 begin
  perform 1 from public.groups;
  raise exception 'anon 그룹 표 조회 허용';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.profiles;
  raise exception 'anon 프로필 표 조회 허용';
 exception when insufficient_privilege then null; end;
 begin
  perform 1 from public.proofs;
  raise exception 'anon 기록 표 조회 허용';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select '비공개 차단·공개 범위·표 접근 차단 검증 통과, 테스트 데이터 롤백 완료' as result;
