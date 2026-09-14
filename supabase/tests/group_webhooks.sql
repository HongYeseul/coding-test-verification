-- 디스코드 알림을 확인하고 롤백합니다.
-- 트리거가 가장 바쁜 세 표에 걸려 있어서, 여기서 예외가 나면 도장 찍기 자체가 막힙니다.
-- 그래서 '알림이 나갔는가'보다 '도장이 멀쩡히 남는가'를 먼저 봅니다.
begin;

insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-00000000ea01','hook-owner@example.invalid'),
 ('00000000-0000-4000-8000-00000000ea02','hook-member@example.invalid');
insert into public.groups(id,name,slug,owner_id,record_kind) values
 ('00000000-0000-4000-8000-00000000eb01','알림 검증','hook-test','00000000-0000-4000-8000-00000000ea01','DURATION');
insert into public.group_members(group_id,user_id,role,status,joined_at) values
 ('00000000-0000-4000-8000-00000000eb01','00000000-0000-4000-8000-00000000ea02','MEMBER','ACTIVE',now());

-- 방장이 아니면 설정하지 못합니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ea02',true);
set local role authenticated;
do $$ begin
 begin
  perform public.set_group_webhook('00000000-0000-4000-8000-00000000eb01',
    'https://discord.com/api/webhooks/123/abc');
  assert false, '멤버가 알림을 설정하지 못해야 함';
 exception when insufficient_privilege then null;
 end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ea01',true);
-- 디스코드가 아닌 주소는 받지 않습니다. pg_net은 어디로든 요청을 보낼 수 있습니다.
do $$
declare bad text;
begin
 foreach bad in array array[
   'https://example.invalid/api/webhooks/1/x',
   'http://discord.com/api/webhooks/1/x',
   'https://discord.com/api/webhooks/1/x?redirect=y',
   'https://evil.invalid/#https://discord.com/api/webhooks/1/x'
 ] loop
  begin
   perform public.set_group_webhook('00000000-0000-4000-8000-00000000eb01', bad);
   assert false, '디스코드가 아닌 주소 거부: ' || bad;
  exception when assert_failure then raise; when others then null;
  end;
 end loop;
end $$;

do $$ begin
 assert public.has_group_webhook('00000000-0000-4000-8000-00000000eb01') = false,
  '아직 설정 안 됨';
 perform public.set_group_webhook('00000000-0000-4000-8000-00000000eb01',
   'https://discord.com/api/webhooks/1234567890/AbC-dEf_123');
 assert public.has_group_webhook('00000000-0000-4000-8000-00000000eb01') = true,
  '설정 후 켜짐';
end $$;

-- 멤버에게는 설정 여부조차 알려주지 않습니다.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000ea02',true);
do $$ begin
 assert public.has_group_webhook('00000000-0000-4000-8000-00000000eb01') = false,
  '멤버에게는 숨김';
end $$;

-- 주소는 표 밖으로 나가지 않습니다.
do $$ begin
 begin
  perform 1 from public.group_webhooks;
  assert false, '멤버가 웹훅 표를 읽지 못해야 함';
 exception when insufficient_privilege then null;
 end;
end $$;

reset role;

-- 여기부터는 도장이 멀쩡히 남는지를 봅니다.
insert into public.proofs(id,group_id,user_id,problem_key,accepted_at,verification_status,start_minutes)
values ('00000000-0000-4000-8000-00000000ec01','00000000-0000-4000-8000-00000000eb01',
        '00000000-0000-4000-8000-00000000ea02','착석',now(),'PENDING',780);
update public.proofs set record_minutes = 260, finished_at = now()
where id = '00000000-0000-4000-8000-00000000ec01';
insert into public.proof_cheers(proof_id,user_id)
values ('00000000-0000-4000-8000-00000000ec01','00000000-0000-4000-8000-00000000ea01');
insert into public.proof_reviews(proof_id,reviewer_id,decision,note)
values ('00000000-0000-4000-8000-00000000ec01','00000000-0000-4000-8000-00000000ea01','REJECTED',
        E'사진이\n   흐립니다');

do $$
declare
 sent text[];
begin
 assert (select count(*) from public.proofs
   where id = '00000000-0000-4000-8000-00000000ec01') = 1, '도장이 남아 있음';

 -- pg_net은 본문을 bytea로 담아 둡니다.
 select array_agg((convert_from(request.body,'UTF8')::jsonb)->>'content' order by request.id)
 into sent from net.http_request_queue request
 where request.url like '%1234567890%';

 assert sent[1] = '**' || (select display_name from public.profiles
   where id = '00000000-0000-4000-8000-00000000ea02') || '**님이 13:00에 착석했습니다.',
  '착석 문장: ' || coalesce(sent[1], '없음');
 assert sent[2] like '%님이 퇴근했습니다. 4시간 20분', '퇴근 문장: ' || coalesce(sent[2], '없음');
 assert sent[3] like '%님에게 응원을 보냈습니다.', '응원 문장: ' || coalesce(sent[3], '없음');
 -- 반려 이유는 한 줄로 펴서 인용합니다.
 assert sent[4] like E'%님의 기록을 반려했습니다.\n> 사진이 흐립니다',
  '반려 문장: ' || coalesce(sent[4], '없음');

 -- 닉네임에 @everyone을 넣어도 서버 전체가 울리면 안 됩니다.
 assert (select count(*) from net.http_request_queue
   where url like '%1234567890%'
     and (convert_from(body,'UTF8')::jsonb)->'allowed_mentions'->'parse' <> '[]'::jsonb) = 0,
  '멘션 파싱 꺼짐';
end $$;

rollback;
select '디스코드 알림 검증 통과' as result;
