create table public.group_invite_codes (
  group_id uuid primary key references public.groups(id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  expires_at timestamptz not null,
  created_by uuid not null references public.profiles(id)
);
alter table public.group_invite_codes enable row level security;
revoke all on public.group_invite_codes from anon, authenticated;
grant select on public.group_invite_codes to authenticated;
create policy invite_codes_select_owner on public.group_invite_codes
for select to authenticated using (private.is_group_owner(group_id));

create table private.invite_code_attempts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  attempts integer not null
);
alter table private.invite_code_attempts enable row level security;
revoke all on private.invite_code_attempts from public, anon, authenticated;

create function public.rotate_group_invite_code(target_group_id uuid, invitation_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_group_owner(target_group_id) then
    raise exception '그룹 소유자만 초대코드를 만들 수 있습니다.';
  end if;
  insert into public.group_invite_codes (group_id, code, expires_at, created_by)
  values (target_group_id, invitation_code, now() + interval '7 days', auth.uid())
  on conflict (group_id) do update set code = excluded.code,
    expires_at = excluded.expires_at, created_by = excluded.created_by;
end;
$$;

create function public.join_group_by_code(invitation_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  attempt_count integer;
  invitation public.group_invite_codes%rowtype;
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
  insert into public.group_members (group_id, user_id, role, status, invited_by)
  values (invitation.group_id, caller, 'MEMBER', 'PENDING', invitation.created_by)
  on conflict (group_id, user_id) do nothing;
  select status into member_status from public.group_members
  where group_id = invitation.group_id and user_id = caller;
  if member_status = 'ACTIVE' then
    return jsonb_build_object('status', 'ACTIVE', 'slug',
      (select slug from public.groups where id = invitation.group_id));
  end if;
  return jsonb_build_object('status', member_status);
end;
$$;
revoke all on function public.rotate_group_invite_code(uuid, text) from public, anon, authenticated;
revoke all on function public.join_group_by_code(text) from public, anon, authenticated;
grant execute on function public.rotate_group_invite_code(uuid, text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;

alter table public.proofs alter column platform_account_id drop not null;
alter table public.proofs alter column problem_url drop not null;
alter table public.proofs add constraint proofs_source_required
  check (platform_account_id is not null or evidence_path is not null);

create or replace function private.validate_proof()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.platform_account_id is not null and not exists (
    select 1 from public.platform_accounts where id = new.platform_account_id and user_id = new.user_id
  ) then raise exception '본인의 플랫폼 계정만 사용할 수 있습니다.'; end if;
  if new.evidence_path is not null and not (
    new.evidence_path like new.group_id::text || '/' || new.user_id::text || '/%'
    and array_length(string_to_array(new.evidence_path, '/'), 1) = 3
    and split_part(new.evidence_path, '/', 3) <> ''
  ) then raise exception '증빙 파일 경로가 올바르지 않습니다.'; end if;
  if new.platform_account_id is null then
    if not exists (
      select 1 from storage.objects where bucket_id = 'proof-evidence' and name = new.evidence_path
        and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
        and (metadata->>'size')::bigint between 1 and 6291456
    ) then raise exception '업로드한 사진을 확인해주세요.'; end if;
  end if;
  return new;
end;
$$;
drop policy proofs_insert_self on public.proofs;
create policy proofs_insert_self on public.proofs for insert to authenticated with check (
  user_id = (select auth.uid()) and verification_status = 'PENDING'
  and private.is_active_group_member(group_id)
  and (platform_account_id is null or exists (
    select 1 from public.platform_accounts account
    where account.id = platform_account_id and account.user_id = (select auth.uid())
  ))
);
-- 기록을 먼저 삭제해야 증빙을 삭제할 수 있습니다. 검수된 기록은 삭제할 수 없습니다.
create or replace function private.is_evidence_mutable(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.proofs where evidence_path = object_name);
$$;
