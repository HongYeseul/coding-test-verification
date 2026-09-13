-- 코딩 스터디에서 인증의 알맹이는 통과 화면이 아니라 풀이 코드다.
-- 코드는 사진의 100분의 1 크기이면서 읽고 비교할 수 있어, 서로에게 남는 것이 더 많다.
-- 코드를 남기면 사진 없이도 인증할 수 있게 한다.
begin;

alter table public.proofs
  add column solution_code text
  check (
    solution_code is null
    or char_length(solution_code) between 1 and 20000
  );

-- 사진·플랫폼 계정·코드 중 하나라도 있으면 출처가 있는 기록으로 봅니다.
-- 사진 필수 확인은 여전히 INSERT에서만 합니다.
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
    and new.solution_code is null
    and private.group_requires_photo(new.group_id)
  then
    raise exception '이 그룹은 사진이나 풀이 코드가 필요합니다.';
  end if;

  return new;
end;
$$;

-- 브라우저에서 직접 요청해도 아무 근거 없는 기록은 들어오지 않습니다.
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
    or solution_code is not null
    or not private.group_requires_photo(group_id)
  )
  and (platform_account_id is null or exists (
    select 1 from public.platform_accounts account
    where account.id = platform_account_id and account.user_id = (select auth.uid())
  ))
);

commit;
