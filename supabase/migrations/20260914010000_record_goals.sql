-- 기상·착석 스터디에서 인증의 알맹이는 '했다'가 아니라 '몇 시에' 또는 '얼마나'입니다.
-- 그룹이 무엇을 적을지 고르고(기록 종류), 목표는 멤버마다 다르므로 각자 정합니다.
--
-- 값은 모두 분(minute) 하나로 다룹니다. 시각이면 그날 자정(한국시간)부터 흐른 분이고,
-- 시간이면 머문 분입니다. 단위를 하나로 두면 목표와의 차이가 뺄셈 한 번으로 나오고
-- 칸에 그릴 때도 형식만 갈립니다.
begin;

alter table public.groups
  add column record_kind text not null default 'NONE'
  check (record_kind in ('NONE', 'CLOCK', 'DURATION'));

-- 목표는 그룹이 아니라 멤버가 정합니다. 기상 시각도 착석 시간도 사람마다 다릅니다.
-- 비워 두면 목표 없이 기록만 남깁니다.
alter table public.group_members
  add column goal_minutes integer
  check (goal_minutes is null or goal_minutes between 0 and 1440);

alter table public.proofs
  add column record_minutes integer
  check (record_minutes is null or record_minutes between 0 and 1440);

create or replace function private.group_record_kind(target_group_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select study_group.record_kind
  from public.groups study_group
  where study_group.id = target_group_id;
$$;

revoke all on function private.group_record_kind(uuid) from public, anon, authenticated;
grant execute on function private.group_record_kind(uuid) to authenticated;

-- 시각·시간 기록은 그 자체가 근거입니다. 코드와 같은 자리를 차지하므로
-- 사진 필수를 켠 그룹에서도 사진 없이 등록됩니다.
-- 기록 종류를 쓰지 않는 그룹에는 값이 들어오지 못하게 막습니다.
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
    and new.record_minutes is not null
    and private.group_record_kind(new.group_id) = 'NONE'
  then
    raise exception '이 그룹은 시각이나 시간을 기록하지 않습니다.';
  end if;

  if tg_op = 'INSERT'
    and new.evidence_path is null
    and new.platform_account_id is null
    and new.solution_code is null
    and new.record_minutes is null
    and private.group_requires_photo(new.group_id)
  then
    raise exception '이 그룹은 사진이나 풀이 코드가 필요합니다.';
  end if;

  return new;
end;
$$;

-- 브라우저에서 직접 요청해도 근거 없는 기록은 들어오지 않습니다.
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
    or record_minutes is not null
    or not private.group_requires_photo(group_id)
  )
  and (record_minutes is null or private.group_record_kind(group_id) <> 'NONE')
  and (platform_account_id is null or exists (
    select 1 from public.platform_accounts account
    where account.id = platform_account_id and account.user_id = (select auth.uid())
  ))
);

-- group_members의 UPDATE는 소유자 정책 하나뿐이라 멤버가 자기 행을 건드릴 수 없습니다.
-- 목표 한 컬럼만 열려고 정책과 컬럼 권한을 손대는 대신 함수 하나로 좁힙니다.
create or replace function public.set_member_goal(
  target_group_id uuid,
  target_goal_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 그룹 멤버만 목표를 정할 수 있습니다.' using errcode = '42501';
  end if;

  if target_goal_minutes is not null
    and (target_goal_minutes < 0 or target_goal_minutes > 1440)
  then
    raise exception '목표는 0분에서 1440분 사이여야 합니다.';
  end if;

  update public.group_members
  set goal_minutes = target_goal_minutes
  where group_id = target_group_id
    and user_id = (select auth.uid())
    and status = 'ACTIVE';
end;
$$;

revoke all on function public.set_member_goal(uuid, integer) from public, anon, authenticated;
grant execute on function public.set_member_goal(uuid, integer) to authenticated;

-- 현황판에 기록 종류와 멤버별 목표, 날짜별 기록값을 더합니다.
-- 시각은 그날 가장 이른 값, 시간은 그날 합계입니다. 종류에 따라 뜻이 다르므로
-- 함수가 골라서 하나만 내려줍니다.
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
  group_record_kind text;
  result jsonb;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 그룹 멤버만 현황판을 볼 수 있습니다.' using errcode = '42501';
  end if;

  -- 그룹이 만들어진 주보다 이전과 아직 오지 않은 주는 볼 수 없습니다.
  select date_trunc('week', group_row.created_at at time zone 'Asia/Seoul')::date,
    group_row.record_kind
    into first_week_start, group_record_kind
  from public.groups group_row where group_row.id = target_group_id;
  first_week_start := least(coalesce(first_week_start, current_week_start), current_week_start);
  group_record_kind := coalesce(group_record_kind, 'NONE');

  -- 주 중간 날짜가 들어와도 그 주 월요일로 맞춥니다.
  week_start := date_trunc('week', coalesce(target_week_start, current_week_start))::date;
  week_start := greatest(least(week_start, current_week_start), first_week_start);
  week_end := week_start + 7;

  -- 최근 기록 목록의 제한과 무관하게 현재 활성 멤버의 전체 기록을 집계합니다.
  with members as (
    select member.user_id, member.role, member.goal_minutes, profile.display_name,
      profile.github_login, profile.bio
    from public.group_members member join public.profiles profile on profile.id = member.user_id
    where member.group_id = target_group_id and member.status = 'ACTIVE'
  ), records as (
    select proof.user_id, proof.verification_status, proof.record_minutes,
      (proof.created_at at time zone 'Asia/Seoul')::date as registered_date
    from public.proofs proof join members member on member.user_id = proof.user_id
    where proof.group_id = target_group_id and proof.created_at <= now()
  ), totals as (
    select user_id,
      -- 반려와 취소 처리 중인 기록은 오늘 참여로 세지 않습니다.
      count(*) filter (where registered_date = today_kst
        and verification_status not in ('REJECTED', 'CANCELING')) as today_submitted,
      count(*) filter (where registered_date >= week_start and registered_date < week_end
        and verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as week_approved,
      count(*) filter (where verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as total_approved,
      count(*) filter (where verification_status = 'PENDING') as pending
    from records group by user_id
  ), daily as (
    select user_id, registered_date,
      count(*) filter (where verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as approved,
      count(*) filter (where verification_status = 'PENDING') as pending,
      count(*) filter (where verification_status = 'REJECTED') as rejected,
      case group_record_kind
        when 'CLOCK' then min(record_minutes) filter (
          where verification_status not in ('REJECTED', 'CANCELING'))
        when 'DURATION' then sum(record_minutes) filter (
          where verification_status not in ('REJECTED', 'CANCELING'))
        else null
      end as record_minutes
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
    'recordKind', group_record_kind,
    'days', (select jsonb_agg(week_start + day_number order by day_number) from generate_series(0, 6) as day_number),
    'members', coalesce(jsonb_agg(jsonb_build_object(
      'userId', member.user_id, 'displayName', member.display_name, 'role', member.role,
      'githubLogin', member.github_login, 'bio', member.bio,
      'goalMinutes', member.goal_minutes,
      'todaySubmitted', coalesce(totals.today_submitted, 0),
      'weekApproved', coalesce(totals.week_approved, 0),
      'totalApproved', coalesce(totals.total_approved, 0), 'pending', coalesce(totals.pending, 0),
      'featuredProofId', featured_photos.id, 'featuredDate', featured_photos.registered_date,
      'days', (select jsonb_agg(jsonb_build_object(
        'date', week_start + day_number,
        'approved', coalesce(daily.approved, 0), 'pending', coalesce(daily.pending, 0),
        'rejected', coalesce(daily.rejected, 0), 'recordMinutes', daily.record_minutes
      ) order by day_number) from generate_series(0, 6) as day_number
      left join daily on daily.user_id = member.user_id and daily.registered_date = week_start + day_number)
    ) order by coalesce(totals.week_approved, 0) desc,
      member.display_name, member.user_id), '[]'::jsonb)
  ) into result from members member
  left join totals on totals.user_id = member.user_id
  left join featured_photos on featured_photos.user_id = member.user_id;
  return result;
end;
$$;

revoke all on function public.get_group_overview(uuid, date) from public, anon, authenticated;
grant execute on function public.get_group_overview(uuid, date) to authenticated;

commit;
