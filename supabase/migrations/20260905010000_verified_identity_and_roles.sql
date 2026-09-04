create or replace function public.accept_group_invitation(
  invitation_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.group_invitations%rowtype;
  current_email text;
  current_github_login text;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select *
  into invitation
  from public.group_invitations
  where token_hash = invitation_token_hash
  for update;

  if not found then
    raise exception '유효하지 않은 초대입니다.';
  end if;

  if invitation.status <> 'PENDING' or invitation.expires_at <= now() then
    raise exception '사용할 수 없는 초대입니다.';
  end if;

  select lower(account.email)
  into current_email
  from auth.users account
  where account.id = (select auth.uid())
    and account.email_confirmed_at is not null;

  -- user_metadata는 사용자가 변경할 수 있으므로 초대 대상 확인에 사용하지 않습니다.
  select lower(coalesce(
    identity_data ->> 'user_name',
    identity_data ->> 'preferred_username'
  ))
  into current_github_login
  from auth.identities
  where user_id = (select auth.uid())
    and provider = 'github'
  limit 1;

  if invitation.target_email is not null
    and lower(invitation.target_email) is distinct from current_email then
    raise exception '초대 대상 이메일과 로그인 계정이 일치하지 않습니다.';
  end if;

  if invitation.target_github_login is not null
    and lower(invitation.target_github_login) is distinct from current_github_login then
    raise exception '초대 대상 GitHub 아이디와 로그인 계정이 일치하지 않습니다.';
  end if;

  insert into public.group_members as existing_membership (
    group_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    invitation.group_id,
    (select auth.uid()),
    'MEMBER',
    'PENDING',
    invitation.created_by
  )
  on conflict (group_id, user_id) do update
  set
    role = 'MEMBER',
    status = 'PENDING',
    invited_by = excluded.invited_by,
    joined_at = null
  where existing_membership.status <> 'ACTIVE';

  update public.group_invitations
  set
    status = 'ACCEPTED',
    accepted_by = (select auth.uid()),
    accepted_at = now()
  where id = invitation.id;

  return invitation.group_id;
end;
$$;

create or replace function private.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.groups study_group
    join public.group_members member on member.group_id = study_group.id
      and member.user_id = study_group.owner_id
    where study_group.id = target_group_id
      and study_group.owner_id = (select auth.uid())
      and member.role = 'OWNER'
      and member.status = 'ACTIVE'
  );
$$;

drop policy proofs_delete_pending_self on public.proofs;
create policy proofs_delete_pending_self
on public.proofs for delete to authenticated
using (
  user_id = (select auth.uid())
  and verification_status = 'PENDING'
  and private.is_active_group_member(group_id)
);

create or replace function public.set_group_member_role(
  target_group_id uuid,
  target_user_id uuid,
  member_role text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_group_owner(target_group_id) then
    raise exception '그룹 소유자만 역할을 변경할 수 있습니다.';
  end if;
  if member_role is null or member_role not in ('MEMBER', 'REVIEWER') then
    raise exception '멤버 또는 검수자 역할을 선택해주세요.';
  end if;

  update public.group_members
  set role = member_role
  where group_id = target_group_id
    and user_id = target_user_id
    and user_id <> (select auth.uid())
    and role <> 'OWNER'
    and status = 'ACTIVE';

  if not found then
    raise exception '역할을 변경할 활성 멤버를 찾을 수 없습니다.';
  end if;
  return true;
end;
$$;

revoke all on function public.set_group_member_role(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;
