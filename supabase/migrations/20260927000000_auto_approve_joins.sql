-- 소유자가 켜 두면 초대코드로 가입을 신청하는 순간 바로 멤버가 됩니다.
--
-- 체험용 스터디처럼 누가 들어올지 미리 알 수 없고, 누가 들어와도 괜찮은 그룹을 위한
-- 설정입니다. 신청할 때마다 소유자가 멤버 관리에서 승인해야 하면, 그사이 들어온 사람은
-- 아무것도 해 보지 못하고 기다리기만 합니다. 기본값은 지금처럼 소유자 승인입니다.
--
-- 켜고 끄는 것은 groups_update_owner 정책이 소유자에게만 엽니다. 켜 두어도 내보낸
-- 멤버(REVOKED)는 다시 들어오지 못합니다. 켜기 전에 들어온 신청은 같은 코드로 다시
-- 신청하면 그때 멤버가 됩니다.
--
-- 본문은 20260905020000(초대코드)의 정의에서 그대로 가져와 고쳤습니다.
begin;

alter table public.groups add column auto_approve_joins boolean not null default false;

create or replace function public.join_group_by_code(invitation_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  attempt_count integer;
  invitation public.group_invite_codes%rowtype;
  approves boolean;
  member_status text;
begin
  if caller is null then raise exception '로그인이 필요합니다.'; end if;
  insert into private.invite_code_attempts as attempts (user_id, window_started_at, attempts)
  values (caller, now(), 1)
  on conflict (user_id) do update set
    window_started_at = case when attempts.window_started_at <= now() - interval '15 minutes'
      then now() else attempts.window_started_at end,
    attempts = case when attempts.window_started_at <= now() - interval '15 minutes'
      then 1 else least(attempts.attempts + 1, 6) end
  returning attempts into attempt_count;
  -- 실패도 반환값으로 처리하여 시도 횟수가 롤백되지 않게 합니다.
  if attempt_count > 5 then return jsonb_build_object('status', 'RATE_LIMITED'); end if;
  select * into invitation from public.group_invite_codes
  where code = upper(trim(invitation_code)) and expires_at > now() for share;
  if not found then return jsonb_build_object('status', 'INVALID'); end if;
  select auto_approve_joins into approves from public.groups where id = invitation.group_id;
  insert into public.group_members as membership
    (group_id, user_id, role, status, invited_by, joined_at)
  values (invitation.group_id, caller, 'MEMBER',
    case when approves then 'ACTIVE' else 'PENDING' end,
    invitation.created_by, case when approves then now() end)
  -- 켜기 전에 들어온 신청만 올립니다. 이미 멤버이거나 내보낸 사람은 그대로 둡니다.
  on conflict (group_id, user_id) do update set status = 'ACTIVE', joined_at = now()
  where approves and membership.status = 'PENDING';
  select status into member_status from public.group_members
  where group_id = invitation.group_id and user_id = caller;
  if member_status = 'ACTIVE' then
    return jsonb_build_object('status', 'ACTIVE', 'slug',
      (select slug from public.groups where id = invitation.group_id));
  end if;
  return jsonb_build_object('status', member_status);
end;
$$;

commit;
