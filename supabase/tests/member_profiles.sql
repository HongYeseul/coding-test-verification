-- 닉네임 제약과 컬럼 단위 권한, GitHub 아이디 동기화를 확인하고 모두 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000c1','profile-owner@example.invalid');
insert into auth.identities(id,provider_id,user_id,provider,identity_data,last_sign_in_at) values
 ('00000000-0000-4000-8000-0000000000c2','9001','00000000-0000-4000-8000-0000000000c1','github',
  '{"sub":"9001","user_name":"ProfileOwner"}'::jsonb,now());
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
set local role authenticated;
do $$
declare
 me uuid := '00000000-0000-4000-8000-0000000000c1';
 blocked text;
begin
 -- 가입할 때 GitHub 아이디가 소문자로 채워져야 합니다.
 assert (select github_login='profileowner' from public.profiles where id=me),
  'GitHub 아이디가 identity에서 채워지지 않았습니다.';

 -- 공백만 있는 이름, 앞뒤 공백, 제어문자, 길이 초과는 DB에서 막습니다.
 foreach blocked in array array[
  '   ',
  ' 예슬',
  '예슬 ',
  '예' || chr(8) || '슬',
  repeat('가', 41)
 ] loop
  begin
   update public.profiles set display_name = blocked where id = me;
   raise exception '허용하면 안 되는 닉네임 저장: %', blocked;
  exception when check_violation then null; end;
 end loop;

 -- 정상 닉네임과 한 줄 소개는 본인이 바꿀 수 있습니다.
 update public.profiles set display_name = '예슬', bio = '매일 한 문제' where id = me;
 assert (select display_name='예슬' and bio='매일 한 문제' from public.profiles where id=me);

 -- 80자를 넘는 한 줄 소개는 막습니다.
 begin
  update public.profiles set bio = repeat('나', 81) where id = me;
  raise exception '허용하면 안 되는 한 줄 소개 저장';
 exception when check_violation then null; end;

 -- 본인 행이라도 GitHub 아이디와 아바타는 컬럼 권한으로 막혀 있어야 합니다.
 begin
  update public.profiles set github_login = 'someone-else' where id = me;
  raise exception 'GitHub 아이디를 사용자가 바꿀 수 있습니다.';
 exception when insufficient_privilege then null; end;
 begin
  update public.profiles set avatar_url = 'https://example.invalid/x.png' where id = me;
  raise exception '아바타 주소를 사용자가 바꿀 수 있습니다.';
 exception when insufficient_privilege then null; end;
 assert (select github_login='profileowner' from public.profiles where id=me);
end $$;
reset role;

-- GitHub 아이디가 바뀌면 프로필도 따라갑니다.
update auth.identities
set identity_data = '{"sub":"9001","user_name":"renamed-owner"}'::jsonb
where id='00000000-0000-4000-8000-0000000000c2';
do $$ begin
 assert (select github_login='renamed-owner' from public.profiles
  where id='00000000-0000-4000-8000-0000000000c1'),
  'GitHub 아이디 변경이 프로필에 반영되지 않았습니다.';
end $$;
rollback;
select '닉네임 제약, 한 줄 소개 길이, GitHub 아이디 컬럼 권한과 동기화 검증 통과, 테스트 데이터 롤백 완료' as result;
