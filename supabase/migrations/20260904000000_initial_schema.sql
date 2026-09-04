create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'MEMBER'
    check (role in ('OWNER', 'REVIEWER', 'MEMBER')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACTIVE', 'REVOKED')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token_hash text not null unique,
  target_email text,
  target_github_login text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (target_email is not null or target_github_login is not null)
);

create table public.platform_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null
    check (
      platform in (
        'CODEFORCES',
        'PROGRAMMERS',
        'LEETCODE',
        'ATCODER',
        'HACKERRANK',
        'CODEWARS'
      )
    ),
  handle text not null check (char_length(handle) between 1 and 100),
  normalized_handle text generated always as (lower(handle)) stored,
  verification_status text not null default 'UNVERIFIED'
    check (
      verification_status in (
        'UNVERIFIED',
        'MANUAL_REVIEWED',
        'API_VERIFIED'
      )
    ),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (verification_status = 'UNVERIFIED' and verified_at is null)
    or (verification_status <> 'UNVERIFIED' and verified_at is not null)
  ),
  unique (platform, normalized_handle),
  unique (user_id, platform)
);

create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform_account_id uuid not null references public.platform_accounts (id) on delete restrict,
  problem_key text not null check (char_length(problem_key) between 1 and 160),
  problem_url text not null,
  problem_title text,
  external_submission_id text,
  accepted_at timestamptz not null,
  verification_status text not null default 'PENDING'
    check (
      verification_status in (
        'PENDING',
        'MANUAL_REVIEWED',
        'API_VERIFIED',
        'REJECTED'
      )
    ),
  evidence_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id, platform_account_id, problem_key)
);

create unique index proofs_external_submission_unique
  on public.proofs (platform_account_id, external_submission_id)
  where external_submission_id is not null;

create unique index proofs_evidence_path_unique
  on public.proofs (evidence_path)
  where evidence_path is not null;

create table public.proof_reviews (
  id uuid primary key default gen_random_uuid(),
  proof_id uuid not null references public.proofs (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete restrict,
  decision text not null check (decision in ('APPROVED', 'REJECTED')),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (proof_id)
);

create index group_members_user_status_idx
  on public.group_members (user_id, status);
create index group_invitations_group_status_idx
  on public.group_invitations (group_id, status);
create index proofs_group_accepted_at_idx
  on public.proofs (group_id, accepted_at desc);
create index proofs_group_status_idx
  on public.proofs (group_id, verification_status);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create trigger groups_touch_updated_at
before update on public.groups
for each row execute function private.touch_updated_at();

create trigger group_members_touch_updated_at
before update on public.group_members
for each row execute function private.touch_updated_at();

create trigger platform_accounts_touch_updated_at
before update on public.platform_accounts
for each row execute function private.touch_updated_at();

create trigger proofs_touch_updated_at
before update on public.proofs
for each row execute function private.touch_updated_at();

create or replace function private.validate_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.platform_accounts account
    where account.id = new.platform_account_id
      and account.user_id = new.user_id
  ) then
    raise exception '풀이 인증에는 본인의 플랫폼 계정만 사용할 수 있습니다.';
  end if;

  if new.evidence_path is not null and not (
    new.evidence_path like new.group_id::text || '/' || new.user_id::text || '/%'
    and array_length(string_to_array(new.evidence_path, '/'), 1) = 3
    and split_part(new.evidence_path, '/', 3) <> ''
  ) then
    raise exception '증빙 파일 경로 형식이 올바르지 않습니다.';
  end if;

  return new;
end;
$$;

create trigger proofs_validate
before insert or update on public.proofs
for each row execute function private.validate_proof();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      nullif(new.raw_user_meta_data ->> 'preferred_username', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'member'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.create_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (
    group_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    new.id,
    new.owner_id,
    'OWNER',
    'ACTIVE',
    new.owner_id,
    now()
  );

  return new;
end;
$$;

create trigger groups_create_owner_membership
after insert on public.groups
for each row execute function private.create_owner_membership();

create or replace function private.apply_proof_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.proofs
  set verification_status = case
    when new.decision = 'APPROVED' then 'MANUAL_REVIEWED'
    else 'REJECTED'
  end
  where id = new.proof_id
    and verification_status = 'PENDING';

  if not found then
    raise exception '검수 대기 중인 인증만 처리할 수 있습니다.';
  end if;

  return new;
end;
$$;

create trigger proof_reviews_apply_decision
after insert on public.proof_reviews
for each row execute function private.apply_proof_review();

create or replace function private.is_active_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members member
    where member.group_id = target_group_id
      and member.user_id = (select auth.uid())
      and member.status = 'ACTIVE'
  );
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
    where study_group.id = target_group_id
      and study_group.owner_id = (select auth.uid())
  );
$$;

create or replace function private.can_review_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members member
    where member.group_id = target_group_id
      and member.user_id = (select auth.uid())
      and member.status = 'ACTIVE'
      and member.role in ('OWNER', 'REVIEWER')
  );
$$;

create or replace function private.shares_active_group(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members mine
    join public.group_members theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'ACTIVE'
      and theirs.user_id = other_user_id
      and theirs.status = 'ACTIVE'
  );
$$;

create or replace function private.can_read_evidence_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
begin
  folders := storage.foldername(object_name);
  return array_length(folders, 1) = 2
    and private.is_active_group_member(folders[1]::uuid);
exception
  when invalid_text_representation then
    return false;
end;
$$;

create or replace function private.is_evidence_mutable(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.proofs proof
    where proof.evidence_path = object_name
      and proof.verification_status <> 'PENDING'
  );
$$;

create or replace function private.can_write_evidence_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
begin
  folders := storage.foldername(object_name);
  return array_length(folders, 1) = 2
    and folders[2] = (select auth.uid())::text
    and private.is_active_group_member(folders[1]::uuid)
    and private.is_evidence_mutable(object_name);
exception
  when invalid_text_representation then
    return false;
end;
$$;

create or replace function private.can_delete_evidence_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  folders text[];
begin
  folders := storage.foldername(object_name);
  return array_length(folders, 1) = 2
    and folders[2] = (select auth.uid())::text
    and private.is_active_group_member(folders[1]::uuid)
    and private.is_evidence_mutable(object_name);
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.validate_proof() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.create_owner_membership() from public, anon, authenticated;
revoke all on function private.apply_proof_review() from public, anon, authenticated;
revoke all on function private.is_active_group_member(uuid) from public, anon, authenticated;
revoke all on function private.is_group_owner(uuid) from public, anon, authenticated;
revoke all on function private.can_review_group(uuid) from public, anon, authenticated;
revoke all on function private.shares_active_group(uuid) from public, anon, authenticated;
revoke all on function private.can_read_evidence_path(text) from public, anon, authenticated;
revoke all on function private.is_evidence_mutable(text) from public, anon, authenticated;
revoke all on function private.can_write_evidence_path(text) from public, anon, authenticated;
revoke all on function private.can_delete_evidence_path(text) from public, anon, authenticated;

grant execute on function private.is_active_group_member(uuid) to authenticated;
grant execute on function private.is_group_owner(uuid) to authenticated;
grant execute on function private.can_review_group(uuid) to authenticated;
grant execute on function private.shares_active_group(uuid) to authenticated;
grant execute on function private.can_read_evidence_path(text) to authenticated;
grant execute on function private.can_write_evidence_path(text) to authenticated;
grant execute on function private.can_delete_evidence_path(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;
alter table public.platform_accounts enable row level security;
alter table public.proofs enable row level security;
alter table public.proof_reviews enable row level security;

create policy profiles_select
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or private.shares_active_group(id)
);

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy groups_select_member
on public.groups for select to authenticated
using (private.is_active_group_member(id));

create policy groups_update_owner
on public.groups for update to authenticated
using (private.is_group_owner(id))
with check (owner_id = (select auth.uid()));

create policy groups_delete_owner
on public.groups for delete to authenticated
using (private.is_group_owner(id));

create policy group_members_select_member
on public.group_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.is_active_group_member(group_id)
);

create policy group_members_insert_owner
on public.group_members for insert to authenticated
with check (
  private.is_group_owner(group_id)
  and user_id <> (select auth.uid())
  and role in ('REVIEWER', 'MEMBER')
  and status in ('PENDING', 'ACTIVE')
);

create policy group_members_update_owner
on public.group_members for update to authenticated
using (
  private.is_group_owner(group_id)
  and user_id <> (select auth.uid())
)
with check (
  private.is_group_owner(group_id)
  and user_id <> (select auth.uid())
  and role in ('REVIEWER', 'MEMBER')
);

create policy group_members_delete_owner
on public.group_members for delete to authenticated
using (
  private.is_group_owner(group_id)
  and user_id <> (select auth.uid())
);

create policy group_invitations_select_manager
on public.group_invitations for select to authenticated
using (private.can_review_group(group_id));

create policy platform_accounts_select_group
on public.platform_accounts for select to authenticated
using (
  user_id = (select auth.uid())
  or private.shares_active_group(user_id)
);

create policy platform_accounts_insert_self
on public.platform_accounts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and verification_status = 'UNVERIFIED'
);

create policy platform_accounts_update_self_unverified
on public.platform_accounts for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and verification_status = 'UNVERIFIED'
);

create policy platform_accounts_delete_self
on public.platform_accounts for delete to authenticated
using (user_id = (select auth.uid()));

create policy proofs_select_member
on public.proofs for select to authenticated
using (private.is_active_group_member(group_id));

create policy proofs_insert_self
on public.proofs for insert to authenticated
with check (
  user_id = (select auth.uid())
  and verification_status = 'PENDING'
  and private.is_active_group_member(group_id)
  and exists (
    select 1
    from public.platform_accounts account
    where account.id = platform_account_id
      and account.user_id = (select auth.uid())
  )
);

create policy proofs_delete_pending_self
on public.proofs for delete to authenticated
using (
  user_id = (select auth.uid())
  and verification_status = 'PENDING'
);

create policy proof_reviews_select_member
on public.proof_reviews for select to authenticated
using (
  exists (
    select 1
    from public.proofs proof
    where proof.id = proof_id
      and private.is_active_group_member(proof.group_id)
  )
);

create policy proof_reviews_insert_reviewer
on public.proof_reviews for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1
    from public.proofs proof
    where proof.id = proof_id
      and proof.verification_status = 'PENDING'
      and proof.user_id <> (select auth.uid())
      and private.can_review_group(proof.group_id)
  )
);

revoke all on table
  public.profiles,
  public.groups,
  public.group_members,
  public.group_invitations,
  public.platform_accounts,
  public.proofs,
  public.proof_reviews
from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, update, delete on table public.groups to authenticated;
grant select, insert, update, delete on table public.group_members to authenticated;
grant select on table public.group_invitations to authenticated;
grant select, insert, update, delete on table public.platform_accounts to authenticated;
grant select, insert, delete on table public.proofs to authenticated;
grant select, insert on table public.proof_reviews to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'proof-evidence',
  'proof-evidence',
  false,
  31457280,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy proof_evidence_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'proof-evidence'
  and private.can_read_evidence_path(name)
);

create policy proof_evidence_insert_self
on storage.objects for insert to authenticated
with check (
  bucket_id = 'proof-evidence'
  and private.can_write_evidence_path(name)
);

create policy proof_evidence_delete_pending_self
on storage.objects for delete to authenticated
using (
  bucket_id = 'proof-evidence'
  and private.can_delete_evidence_path(name)
);
