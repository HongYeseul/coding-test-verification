-- 현황판이 이번 주 외의 주도 조회할 수 있도록 조회할 주를 인자로 받습니다.
-- 인자를 추가하면 다른 함수가 되므로 기존 1인자 함수를 먼저 제거합니다.
begin;

drop function public.get_group_overview(uuid);

create function public.get_group_overview(
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
    select member.user_id, member.role, profile.display_name
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
        and verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as week_approved,
      count(*) filter (where verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as total_approved,
      count(*) filter (where verification_status = 'PENDING') as pending
    from records group by user_id
  ), daily as (
    select user_id, registered_date,
      count(*) filter (where verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as approved,
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
      'todaySubmitted', coalesce(totals.today_submitted, 0),
      'weekApproved', coalesce(totals.week_approved, 0),
      'totalApproved', coalesce(totals.total_approved, 0), 'pending', coalesce(totals.pending, 0),
      'featuredProofId', featured_photos.id, 'featuredDate', featured_photos.registered_date,
      'days', (select jsonb_agg(jsonb_build_object(
        'date', week_start + day_number,
        'approved', coalesce(daily.approved, 0), 'pending', coalesce(daily.pending, 0), 'rejected', coalesce(daily.rejected, 0)
      ) order by day_number) from generate_series(0, 6) as day_number
      left join daily on daily.user_id = member.user_id and daily.registered_date = week_start + day_number)
    ) order by member.display_name, member.user_id), '[]'::jsonb)
  ) into result from members member
  left join totals on totals.user_id = member.user_id
  left join featured_photos on featured_photos.user_id = member.user_id;
  return result;
end;
$$;

revoke all on function public.get_group_overview(uuid, date) from public, anon, authenticated;
grant execute on function public.get_group_overview(uuid, date) to authenticated;

commit;
