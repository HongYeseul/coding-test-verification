-- 인증 종류를 유형 enum이 아니라 그룹 설정 두 개로 나눕니다.
-- 사진 필수와 코딩 테스트 여부는 서로 독립이라 조합 네 가지가 모두 유효합니다.
-- 기존 그룹은 전부 코딩 테스트 스터디이므로 켠 상태로 옮겨 화면이 그대로 유지됩니다.
begin;

alter table public.groups
  add column requires_photo boolean not null default true,
  add column is_coding_study boolean not null default false;

update public.groups set is_coding_study = true;

-- 출처가 있어야 한다는 규칙을 그룹 설정에 맡깁니다.
alter table public.proofs drop constraint proofs_source_required;

create or replace function private.group_requires_photo(target_group_id uuid)
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
      and study_group.requires_photo
  );
$$;

revoke all on function private.group_requires_photo(uuid) from public, anon, authenticated;
grant execute on function private.group_requires_photo(uuid) to authenticated;

-- 사진을 올렸다고 적은 기록은 실제 업로드가 있어야 하고,
-- 아무 출처도 없는 기록은 사진 필수를 끈 그룹에서만 만들 수 있습니다.
-- 사진 필수 확인은 INSERT에서만 합니다. 설정을 바꿔도 이미 등록된 기록의 검수는 막히지 않습니다.
create or replace function private.validate_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform_account_id is not null and not exists (
    select 1 from public.platform_accounts
    where id = new.platform_account_id and user_id = new.user_id
  ) then
    raise exception '본인의 플랫폼 계정만 사용할 수 있습니다.';
  end if;

  if new.evidence_path is not null and not (
    new.evidence_path like new.group_id::text || '/' || new.user_id::text || '/%'
    and array_length(string_to_array(new.evidence_path, '/'), 1) = 3
    and split_part(new.evidence_path, '/', 3) <> ''
  ) then
    raise exception '증빙 파일 경로가 올바르지 않습니다.';
  end if;

  if new.evidence_path is not null and not exists (
    select 1 from storage.objects
    where bucket_id = 'proof-evidence'
      and name = new.evidence_path
      and metadata->>'mimetype' in ('image/jpeg', 'image/png', 'image/webp')
      and (metadata->>'size')::bigint between 1 and 6291456
  ) then
    raise exception '업로드한 사진을 확인해주세요.';
  end if;

  if tg_op = 'INSERT'
    and new.evidence_path is null
    and new.platform_account_id is null
    and private.group_requires_photo(new.group_id)
  then
    raise exception '이 그룹은 사진 인증이 필요합니다.';
  end if;

  return new;
end;
$$;

-- 브라우저에서 직접 요청해도 사진 필수 그룹에는 사진 없는 기록이 들어오지 않습니다.
drop policy proofs_insert_self on public.proofs;
create policy proofs_insert_self on public.proofs for insert to authenticated with check (
  user_id = (select auth.uid())
  and private.is_active_group_member(group_id)
  and (
    verification_status = 'PENDING'
    or (
      verification_status = 'AUTO_APPROVED'
      and private.group_auto_approves(group_id)
    )
  )
  and (
    evidence_path is not null
    or platform_account_id is not null
    or not private.group_requires_photo(group_id)
  )
  and (platform_account_id is null or exists (
    select 1 from public.platform_accounts account
    where account.id = platform_account_id and account.user_id = (select auth.uid())
  ))
);

-- 사진 기록은 proofs_evidence_path_unique가 재시도 중복을 막습니다.
-- 사진 없는 기록에는 그 열쇠가 없으므로 앱이 만든 problem_key가 같은 자리를 맡습니다.
create unique index proofs_photoless_key_unique
  on public.proofs (group_id, user_id, problem_key)
  where evidence_path is null and platform_account_id is null;

-- 2인자 함수는 남겨 둡니다. 아직 배포되지 않은 화면이 그걸 부르고 있어,
-- 여기서 지우면 새 코드가 뜨기 전까지 그룹 생성이 막힙니다.
-- 기본값 없는 3인자라 인자 수로 구분되어 모호하지 않습니다.
-- 배포가 끝나면 20260913010000_drop_legacy_create_group.sql로 지웁니다.
create function public.create_group(
  group_name text,
  group_slug text,
  coding_study boolean
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

  insert into public.groups (name, slug, owner_id, is_coding_study)
  values (group_name, group_slug, (select auth.uid()), coalesce(coding_study, false))
  returning id into created_group_id;

  return created_group_id;
end;
$$;

revoke all on function public.create_group(text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_group(text, text, boolean) to authenticated;

commit;
