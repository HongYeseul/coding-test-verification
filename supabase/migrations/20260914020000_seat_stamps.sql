-- 착석 스터디에서 앉아 있던 시간을 직접 적지 않고 도장 두 번으로 재게 합니다.
-- 착석할 때 한 번, 퇴근할 때 한 번 찍으면 그 차이가 그날의 시간입니다.
-- 직접 적는 값보다 정확하고, 시각 기록과 문법이 같아집니다.
--
-- 하루는 한 구간입니다. 오전·오후로 나눠 앉는 경우는 받지 않습니다 — 구간마다
-- 기록이 생기면 도장판의 승인 건수가 구간 수만큼 늘어 순위 기준이 흔들립니다.
begin;

-- 착석한 시각입니다. 그날 자정(한국시간)부터 흐른 분이고, 퇴근하면
-- record_minutes에 두 시각의 차이가 들어갑니다.
alter table public.proofs
  add column start_minutes integer
  check (start_minutes is null or start_minutes between 0 and 1440);

-- 착석 도장도 그 자체로 근거입니다. 아직 시간은 모르지만 앉은 것은 사실입니다.
-- 하루 한 구간이라 같은 스터디 하루에 두 번째 기록은 만들지 못합니다.
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
    and new.start_minutes is not null
    and private.group_record_kind(new.group_id) <> 'DURATION'
  then
    raise exception '착석 도장은 시간을 기록하는 그룹에서만 찍습니다.';
  end if;

  -- 하루 한 구간입니다. 착석만 해 둔 기록이 있으면 퇴근 도장으로 채웁니다.
  if tg_op = 'INSERT'
    and private.group_record_kind(new.group_id) = 'DURATION'
    and exists (
      select 1 from public.proofs existing
      where existing.group_id = new.group_id
        and existing.user_id = new.user_id
        and existing.verification_status <> 'CANCELING'
        and private.study_date(existing.created_at) = private.study_date(now())
    )
  then
    raise exception '오늘은 이미 기록이 있습니다.';
  end if;

  if tg_op = 'INSERT'
    and new.evidence_path is null
    and new.platform_account_id is null
    and new.solution_code is null
    and new.record_minutes is null
    and new.start_minutes is null
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
    or start_minutes is not null
    or not private.group_requires_photo(group_id)
  )
  and (record_minutes is null or private.group_record_kind(group_id) <> 'NONE')
  and (start_minutes is null or private.group_record_kind(group_id) = 'DURATION')
  and (platform_account_id is null or exists (
    select 1 from public.platform_accounts account
    where account.id = platform_account_id and account.user_id = (select auth.uid())
  ))
);

/**
 * 퇴근 도장입니다. 오늘 착석만 해 둔 기록을 찾아 시간을 채웁니다.
 * `target_minutes`를 비우면 지금 시각까지로 재고, 값을 주면 그 시간으로 고칩니다 —
 * 퇴근 도장을 잊은 날 직접 보정하는 통로입니다.
 *
 * proofs에는 UPDATE 권한이 없으므로(취소 함수와 같은 이유) 이 함수로만 고칩니다.
 */
create or replace function public.finish_seat_record(
  target_group_id uuid,
  target_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proof public.proofs%rowtype;
  seoul_now timestamp;
  end_minutes integer;
  duration integer;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 멤버만 도장을 찍을 수 있습니다.' using errcode = '42501';
  end if;
  if private.group_record_kind(target_group_id) <> 'DURATION' then
    raise exception '시간을 기록하는 그룹이 아닙니다.' using errcode = '42501';
  end if;
  if target_minutes is not null
    and (target_minutes < 1 or target_minutes > 1440)
  then
    raise exception '시간은 1분에서 1440분 사이여야 합니다.';
  end if;

  -- 오늘 착석만 해 둔 기록 하나입니다. 하루 한 구간이라 둘 이상 나올 수 없습니다.
  select * into proof from public.proofs
  where group_id = target_group_id
    and user_id = (select auth.uid())
    and start_minutes is not null
    and record_minutes is null
    and verification_status <> 'CANCELING'
    and private.study_date(created_at) = private.study_date(now())
  for update;
  if not found then
    raise exception '오늘 착석 도장이 없습니다.' using errcode = '42501';
  end if;

  if target_minutes is null then
    seoul_now := now() at time zone 'Asia/Seoul';
    end_minutes := extract(hour from seoul_now)::integer * 60
      + extract(minute from seoul_now)::integer;
    duration := end_minutes - proof.start_minutes;
    -- 자정을 넘겨 앉아 있었으면 하루를 더합니다. 스터디 하루는 새벽 3시에 끝나므로
    -- 자정을 넘긴 퇴근도 같은 날의 기록입니다.
    if duration <= 0 then
      duration := duration + 1440;
    end if;
  else
    duration := target_minutes;
  end if;

  update public.proofs set record_minutes = duration where id = proof.id;
  return jsonb_build_object(
    'startMinutes', proof.start_minutes,
    'recordMinutes', duration
  );
end;
$$;

revoke all on function public.finish_seat_record(uuid, integer) from public, anon, authenticated;
grant execute on function public.finish_seat_record(uuid, integer) to authenticated;

-- 현황판이 날짜마다 착석 시각도 함께 내려줍니다. 아직 퇴근하지 않은 칸을
-- ‘13:00~’으로 보여주려면 시간만으로는 알 수 없습니다.
create or replace function public.get_group_overview(
  target_group_id uuid,
  target_week_start date default null
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today_kst date := private.study_date(now());
  current_week_start date := date_trunc('week', private.study_date(now()))::date;
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
  select date_trunc('week', private.study_date(group_row.created_at))::date,
    group_row.record_kind
    into first_week_start, group_record_kind
  from public.groups group_row where group_row.id = target_group_id;
  first_week_start := least(coalesce(first_week_start, current_week_start), current_week_start);
  group_record_kind := coalesce(group_record_kind, 'NONE');

  -- 주 중간 날짜가 들어와도 그 주 월요일로 맞춥니다.
  week_start := date_trunc('week', coalesce(target_week_start, current_week_start))::date;
  week_start := greatest(least(week_start, current_week_start), first_week_start);
  week_end := week_start + 7;

  with members as (
    select member.user_id, member.role, member.goal_minutes, profile.display_name,
      profile.github_login, profile.bio
    from public.group_members member join public.profiles profile on profile.id = member.user_id
    where member.group_id = target_group_id and member.status = 'ACTIVE'
  ), records as (
    select proof.user_id, proof.verification_status, proof.record_minutes,
      proof.start_minutes, private.study_date(proof.created_at) as registered_date
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
      end as record_minutes,
      case group_record_kind
        when 'DURATION' then min(start_minutes) filter (
          where verification_status not in ('REJECTED', 'CANCELING'))
        else null
      end as start_minutes
    from records where registered_date >= week_start and registered_date < week_end
    group by user_id, registered_date
  ), featured_photos as (
    select distinct on (proof.user_id) proof.user_id, proof.id,
      private.study_date(proof.created_at) as registered_date
    from public.proofs proof join members member on member.user_id = proof.user_id
    where proof.group_id = target_group_id
      and proof.evidence_path is not null
      and proof.verification_status <> 'CANCELING'
      and private.study_date(proof.created_at) >= week_start
      and private.study_date(proof.created_at) < week_end
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
        'rejected', coalesce(daily.rejected, 0), 'recordMinutes', daily.record_minutes,
        'startMinutes', daily.start_minutes
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
