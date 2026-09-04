create or replace function private.can_manage_pending_member(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members manager
    join public.group_members pending
      on pending.group_id = manager.group_id
    where manager.user_id = (select auth.uid())
      and manager.role = 'OWNER'
      and manager.status = 'ACTIVE'
      and pending.user_id = target_user_id
      and pending.status = 'PENDING'
  );
$$;

create policy profiles_select_pending_member_manager
on public.profiles for select to authenticated
using (private.can_manage_pending_member(id));

create or replace function public.create_group(
  group_name text,
  group_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_group_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception '로그인이 필요합니다.';
  end if;

  group_name := btrim(group_name);
  group_slug := lower(btrim(group_slug));

  if char_length(group_name) not between 1 and 60 then
    raise exception '그룹 이름은 1자 이상 60자 이하여야 합니다.';
  end if;

  if group_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception '그룹 주소 형식이 올바르지 않습니다.';
  end if;

  insert into public.groups (name, slug, owner_id)
  values (group_name, group_slug, (select auth.uid()))
  returning id into created_group_id;

  return created_group_id;
end;
$$;

create or replace function public.create_group_invitation(
  target_group_id uuid,
  invitation_token_hash text,
  invitation_target_email text,
  invitation_target_github_login text,
  invitation_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_invitation_id uuid;
begin
  if not private.is_group_owner(target_group_id) then
    raise exception '그룹 소유자만 초대를 만들 수 있습니다.';
  end if;

  invitation_target_email := nullif(lower(btrim(invitation_target_email)), '');
  invitation_target_github_login := nullif(lower(btrim(invitation_target_github_login)), '');

  if (invitation_target_email is null) = (invitation_target_github_login is null) then
    raise exception '이메일 또는 GitHub 아이디 중 하나를 입력해주세요.';
  end if;

  if invitation_expires_at <= now() or invitation_expires_at > now() + interval '30 days' then
    raise exception '초대 만료일은 30일 이내여야 합니다.';
  end if;

  if invitation_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception '초대 토큰 형식이 올바르지 않습니다.';
  end if;

  insert into public.group_invitations (
    group_id,
    token_hash,
    target_email,
    target_github_login,
    expires_at,
    created_by
  )
  values (
    target_group_id,
    invitation_token_hash,
    invitation_target_email,
    invitation_target_github_login,
    invitation_expires_at,
    (select auth.uid())
  )
  returning id into created_invitation_id;

  return created_invitation_id;
end;
$$;

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

  current_email := lower(coalesce((select auth.jwt()) ->> 'email', ''));
  current_github_login := lower(coalesce(
    (select auth.jwt()) -> 'user_metadata' ->> 'user_name',
    (select auth.jwt()) -> 'user_metadata' ->> 'preferred_username',
    ''
  ));

  if invitation.target_email is not null
    and lower(invitation.target_email) <> current_email then
    raise exception '초대 대상 이메일과 로그인 계정이 일치하지 않습니다.';
  end if;

  if invitation.target_github_login is not null
    and lower(invitation.target_github_login) <> current_github_login then
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

create or replace function public.approve_group_member(
  target_group_id uuid,
  target_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_group_owner(target_group_id) then
    raise exception '그룹 소유자만 가입을 승인할 수 있습니다.';
  end if;

  update public.group_members
  set
    status = 'ACTIVE',
    joined_at = now()
  where group_id = target_group_id
    and user_id = target_user_id
    and role <> 'OWNER'
    and status = 'PENDING';

  if not found then
    raise exception '승인 대기 중인 멤버를 찾을 수 없습니다.';
  end if;

  return true;
end;
$$;

revoke all on function private.can_manage_pending_member(uuid)
from public, anon, authenticated;

revoke all on function public.create_group(text, text)
from public, anon, authenticated;
revoke all on function public.create_group_invitation(uuid, text, text, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.accept_group_invitation(text)
from public, anon, authenticated;
revoke all on function public.approve_group_member(uuid, uuid)
from public, anon, authenticated;

grant execute on function private.can_manage_pending_member(uuid) to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.create_group_invitation(uuid, text, text, text, timestamptz)
to authenticated;
grant execute on function public.accept_group_invitation(text) to authenticated;
grant execute on function public.approve_group_member(uuid, uuid) to authenticated;
