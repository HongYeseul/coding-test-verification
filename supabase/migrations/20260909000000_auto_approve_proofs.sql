-- 그룹이 자동 인정을 켜면 등록하는 순간 인정으로 시작하고, 검수자가 반려할 때만 내려갑니다.
-- 기본값은 지금까지와 같은 검수 대기이며, 켜고 끄는 것은 소유자만 할 수 있습니다.
begin;

alter table public.groups add column auto_approve boolean not null default false;

-- 자동 인정으로 시작한 기록을 사람이 승인한 기록과 구분해 셉니다.
alter table public.proofs drop constraint proofs_verification_status_check;
alter table public.proofs add constraint proofs_verification_status_check check (
  verification_status in (
    'PENDING',
    'AUTO_APPROVED',
    'MANUAL_REVIEWED',
    'API_VERIFIED',
    'REJECTED',
    'CANCELING'
  )
);

create or replace function private.group_auto_approves(target_group_id uuid)
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
      and study_group.auto_approve
  );
$$;

revoke all on function private.group_auto_approves(uuid) from public, anon, authenticated;
grant execute on function private.group_auto_approves(uuid) to authenticated;

-- 자동 인정을 켠 그룹에서만 AUTO_APPROVED로 기록을 만들 수 있습니다.
-- 설정이 꺼져 있으면 브라우저에서 직접 요청해도 검수 대기로만 들어옵니다.
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
  and (platform_account_id is null or exists (
    select 1 from public.platform_accounts account
    where account.id = platform_account_id and account.user_id = (select auth.uid())
  ))
);

-- 자동 인정된 기록도 검수자가 반려하거나 승인으로 확정할 수 있어야 합니다.
drop policy proof_reviews_insert_reviewer on public.proof_reviews;
create policy proof_reviews_insert_reviewer on public.proof_reviews for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1
    from public.proofs proof
    where proof.id = proof_id
      and proof.verification_status in ('PENDING', 'AUTO_APPROVED')
      and proof.user_id <> (select auth.uid())
      and private.can_review_group(proof.group_id)
  )
);

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
    and verification_status in ('PENDING', 'AUTO_APPROVED');

  if not found then
    raise exception '검수 대기이거나 자동 인정된 기록만 처리할 수 있습니다.';
  end if;

  return new;
end;
$$;

-- 자동 인정은 즉시 인정이라, 잘못 올린 사진을 본인이 지울 수 있어야 합니다.
create or replace function public.begin_proof_cancellation(
  target_group_id uuid,
  target_proof_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare proof public.proofs%rowtype;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 멤버만 취소할 수 있습니다.' using errcode='42501';
  end if;
  select * into proof from public.proofs where id=target_proof_id
    and group_id=target_group_id and user_id=auth.uid() for update;
  if not found then return null; end if;
  if proof.verification_status not in ('PENDING','AUTO_APPROVED','CANCELING') then
    raise exception '검수 대기이거나 자동 인정된 본인 기록만 취소할 수 있습니다.' using errcode='42501';
  end if;
  if proof.verification_status in ('PENDING','AUTO_APPROVED') then
    update public.proofs set verification_status='CANCELING' where id=proof.id;
  end if;
  return jsonb_build_object('id',proof.id,'evidence_path',proof.evidence_path);
end;
$$;

-- 현황판의 승인 집계에 자동 인정을 더합니다. 검수 대기 집계는 PENDING 그대로입니다.
-- 나머지 본문은 20260907040000과 같습니다.
create or replace function public.get_group_overview(
  target_group_id uuid,
  target_week_start date default null
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  current_week_start date := date_trunc('week', now() at time zone 'Asia/Seoul')::date;
  first_week_start date;
  week_start date;
  week_end date;
  result jsonb;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 그룹 멤버만 현황판을 볼 수 있습니다.' using errcode = '42501';
  end if;

  -- 그룹이 만들어진 주보다 이전과 아직 오지 않은 주는 볼 수 없습니다.
  select date_trunc('week', group_row.created_at at time zone 'Asia/Seoul')::date
    into first_week_start
  from public.groups group_row where group_row.id = target_group_id;
  first_week_start := least(coalesce(first_week_start, current_week_start), current_week_start);

  -- 주 중간 날짜가 들어와도 그 주 월요일로 맞춥니다.
  week_start := date_trunc('week', coalesce(target_week_start, current_week_start))::date;
  week_start := greatest(least(week_start, current_week_start), first_week_start);
  week_end := week_start + 7;

  -- 최근 기록 목록의 제한과 무관하게 현재 활성 멤버의 전체 기록을 집계합니다.
  with members as (
    select member.user_id, member.role, profile.display_name,
      profile.github_login, profile.bio
    from public.group_members member join public.profiles profile on profile.id = member.user_id
    where member.group_id = target_group_id and member.status = 'ACTIVE'
  ), records as (
    select proof.user_id, proof.verification_status,
      (proof.created_at at time zone 'Asia/Seoul')::date as registered_date
    from public.proofs proof join members member on member.user_id = proof.user_id
    where proof.group_id = target_group_id and proof.created_at <= now()
  ), totals as (
    select user_id,
      -- 반려와 취소 처리 중인 기록은 오늘 참여로 세지 않습니다.
      count(*) filter (where registered_date = today_kst
        and verification_status not in ('REJECTED', 'CANCELING')) as today_submitted,
      count(*) filter (where registered_date >= week_start and registered_date < week_end
        and verification_status in ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')) as week_approved,
      count(*) filter (where verification_status in ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')) as total_approved,
      count(*) filter (where verification_status = 'PENDING') as pending
    from records group by user_id
  ), daily as (
    select user_id, registered_date,
      count(*) filter (where verification_status in ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')) as approved,
      count(*) filter (where verification_status = 'PENDING') as pending,
      count(*) filter (where verification_status = 'REJECTED') as rejected
    from records where registered_date >= week_start and registered_date < week_end
    group by user_id, registered_date
  ), featured_photos as (
    select distinct on (proof.user_id) proof.user_id, proof.id,
      (proof.created_at at time zone 'Asia/Seoul')::date as registered_date
    from public.proofs proof join members member on member.user_id = proof.user_id
    where proof.group_id = target_group_id
      and proof.evidence_path is not null
      and proof.verification_status <> 'CANCELING'
      and (proof.created_at at time zone 'Asia/Seoul')::date >= week_start
      and (proof.created_at at time zone 'Asia/Seoul')::date < week_end
      and proof.created_at <= now()
    order by proof.user_id, proof.created_at, proof.id
  )
  select jsonb_build_object(
    'today', today_kst, 'weekStart', week_start, 'weekEnd', week_start + 6,
    'currentWeekStart', current_week_start, 'firstWeekStart', first_week_start,
    'days', (select jsonb_agg(week_start + day_number order by day_number) from generate_series(0, 6) as day_number),
    'members', coalesce(jsonb_agg(jsonb_build_object(
      'userId', member.user_id, 'displayName', member.display_name, 'role', member.role,
      'githubLogin', member.github_login, 'bio', member.bio,
      'todaySubmitted', coalesce(totals.today_submitted, 0),
      'weekApproved', coalesce(totals.week_approved, 0),
      'totalApproved', coalesce(totals.total_approved, 0), 'pending', coalesce(totals.pending, 0),
      'featuredProofId', featured_photos.id, 'featuredDate', featured_photos.registered_date,
      'days', (select jsonb_agg(jsonb_build_object(
        'date', week_start + day_number,
        'approved', coalesce(daily.approved, 0), 'pending', coalesce(daily.pending, 0), 'rejected', coalesce(daily.rejected, 0)
      ) order by day_number) from generate_series(0, 6) as day_number
      left join daily on daily.user_id = member.user_id and daily.registered_date = week_start + day_number)
    ) order by member.user_id), '[]'::jsonb)
  ) into result from members member
  left join totals on totals.user_id = member.user_id
  left join featured_photos on featured_photos.user_id = member.user_id;
  return result;
end;
$$;

revoke all on function public.get_group_overview(uuid, date) from public, anon, authenticated;
grant execute on function public.get_group_overview(uuid, date) to authenticated;

commit;
