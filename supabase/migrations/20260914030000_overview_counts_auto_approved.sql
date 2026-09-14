-- 현황판의 승인 집계에서 자동 인정이 빠져 있었습니다. 자동 인정 그룹에서는
-- 누적과 이번 주 승인이 실제보다 적게 나오고, 칸에 도장이 아예 찍히지 않았습니다.
--
-- 20260914010000에서 함수 본문을 옛 파일(20260907030000)에서 옮겨 오면서 생긴 회귀입니다.
-- 그때 한국시간 새벽 3시 경계도 함께 되돌아갔고 그쪽은 20260914020000에서 고쳤습니다.
-- 인정으로 세는 상태는 ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED') 셋이며,
-- 첫 화면 목록과 공개 리더보드가 쓰는 것과 같은 묶음입니다.
--
-- 함수를 옮겨 쓸 때는 반드시 가장 최근 정의에서 시작하세요.
-- supabase/tests/overview_counts.sql이 이 어긋남을 잡습니다.
begin;

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
        and verification_status in ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')) as week_approved,
      count(*) filter (where verification_status in ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')) as total_approved,
      count(*) filter (where verification_status = 'PENDING') as pending
    from records group by user_id
  ), daily as (
    select user_id, registered_date,
      count(*) filter (where verification_status in ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')) as approved,
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
