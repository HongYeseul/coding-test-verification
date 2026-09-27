-- 가입 자동 승인을 켠 그룹만 초대코드 신청이 바로 멤버가 되는지, 켜고 끄는 것은 소유자만
-- 할 수 있는지, 내보낸 멤버는 켜 두어도 돌아오지 못하는지 확인하고 롤백합니다.
begin;
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000c1','join-owner@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c2','join-newcomer@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c3','join-earlier@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c4','join-revoked@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c5','join-member@example.invalid'),
 ('00000000-0000-4000-8000-0000000000c6','join-late@example.invalid');
insert into public.groups(id,name,slug,owner_id) values
 ('00000000-0000-4000-8000-0000000000d1','체험 스터디','auto-join-test','00000000-0000-4000-8000-0000000000c1'),
 ('00000000-0000-4000-8000-0000000000d2','승인 스터디','manual-join-test','00000000-0000-4000-8000-0000000000c1');
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c4','MEMBER','REVOKED',null),
 ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000c5','MEMBER','ACTIVE',now());

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
set local role authenticated;
select public.rotate_group_invite_code('00000000-0000-4000-8000-0000000000d1','AUTXJ');
select public.rotate_group_invite_code('00000000-0000-4000-8000-0000000000d2','MANLQ');

-- 켜기 전에 신청한 사람은 지금처럼 승인을 기다립니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
do $$ begin
 assert public.join_group_by_code('AUTXJ')->>'status' = 'PENDING', '켜기 전 신청은 대기';
end $$;

-- 소유자가 아닌 멤버는 켤 수 없습니다. 정책에 걸려 바뀌는 행이 없습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c5',true);
do $$ begin
 update public.groups set auto_approve_joins = true
 where id = '00000000-0000-4000-8000-0000000000d1';
 assert not found, '멤버가 가입 자동 승인을 켬';
 assert (select not auto_approve_joins from public.groups
  where id = '00000000-0000-4000-8000-0000000000d1'), '멤버가 가입 자동 승인을 켬';
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
do $$ begin
 update public.groups set auto_approve_joins = true
 where id = '00000000-0000-4000-8000-0000000000d1';
 assert found, '소유자가 가입 자동 승인을 켜지 못함';
end $$;

-- 켠 그룹은 신청하는 순간 멤버가 되고, 끈 그룹은 그대로 승인을 기다립니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c2',true);
do $$ declare result jsonb; begin
 result := public.join_group_by_code('autxj');
 assert result->>'status' = 'ACTIVE' and result->>'slug' = 'auto-join-test', '켠 그룹은 바로 멤버';
 assert (select count(*) = 1 from public.groups
  where id = '00000000-0000-4000-8000-0000000000d1'), '승인 없이 그룹 조회';
 assert (select role = 'MEMBER' and joined_at is not null from public.group_members
  where group_id = '00000000-0000-4000-8000-0000000000d1'
   and user_id = '00000000-0000-4000-8000-0000000000c2'), '가입 시각과 역할';
 assert public.join_group_by_code('MANLQ')->>'status' = 'PENDING', '끈 그룹은 대기';
 assert (select count(*) = 0 from public.groups
  where id = '00000000-0000-4000-8000-0000000000d2'), '대기 중 그룹 조회 차단';
end $$;

-- 켜기 전에 신청한 사람은 같은 코드로 다시 신청하면 멤버가 됩니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c3',true);
do $$ begin
 assert public.join_group_by_code('AUTXJ')->>'status' = 'ACTIVE', '켜기 전 신청의 재신청';
end $$;

-- 내보낸 멤버는 켜 두어도 돌아오지 못합니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c4',true);
do $$ begin
 assert public.join_group_by_code('AUTXJ')->>'status' = 'REVOKED', '내보낸 멤버 복귀';
 assert (select count(*) = 0 from public.groups
  where id = '00000000-0000-4000-8000-0000000000d1'), '내보낸 멤버 그룹 조회';
end $$;

-- 소유자가 자기 코드로 신청해도 역할은 그대로이고, 끄면 다시 승인을 기다립니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c1',true);
do $$ begin
 assert public.join_group_by_code('AUTXJ')->>'status' = 'ACTIVE', '소유자 재신청';
 assert (select role = 'OWNER' from public.group_members
  where group_id = '00000000-0000-4000-8000-0000000000d1'
   and user_id = '00000000-0000-4000-8000-0000000000c1'), '소유자 역할 유지';
 update public.groups set auto_approve_joins = false
 where id = '00000000-0000-4000-8000-0000000000d1';
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000000c6',true);
do $$ begin
 assert public.join_group_by_code('AUTXJ')->>'status' = 'PENDING', '끈 뒤 신청은 대기';
end $$;
reset role;
rollback;
select '가입 자동 승인·소유자만 설정·내보낸 멤버 차단 검증 통과, 테스트 데이터 롤백 완료' as result;
