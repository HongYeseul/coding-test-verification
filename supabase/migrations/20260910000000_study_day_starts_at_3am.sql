-- 하루의 경계를 자정에서 한국시간 새벽 3시로 옮깁니다.
-- 새벽 2시에 올린 인증은 전날 푼 것으로 세는 게 실제 생활에 가깝습니다.
-- 규칙을 함수 하나에 두어 현황판·첫 화면 목록·공개 리더보드가 같은 경계를 씁니다.
-- 이미 쌓인 기록에도 같은 규칙이 적용되므로 자정 직후 등록분은 전날로 옮겨집니다.
begin;

-- timezone() 자체가 STABLE이라 이 함수도 IMMUTABLE로 둘 수 없습니다.
create or replace function private.study_date(moment timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select ((moment at time zone 'Asia/Seoul') - interval '3 hours')::date;
$$;

revoke all on function private.study_date(timestamptz) from public, anon, authenticated;
grant execute on function private.study_date(timestamptz) to authenticated;

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
  result jsonb;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 그룹 멤버만 현황판을 볼 수 있습니다.' using errcode = '42501';
  end if;

  -- 그룹이 만들어진 주보다 이전과 아직 오지 않은 주는 볼 수 없습니다.
  select date_trunc('week', private.study_date(group_row.created_at))::date
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
      private.study_date(proof.created_at) as registered_date
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

create or replace function public.get_group_directory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with week as (
    select
      date_trunc('week', private.study_date(now()))::date as start,
      private.study_date(now()) as today
  ), daily as (
    -- 요일 번호를 여기서 계산해야 아래 LEFT JOIN의 ON에서 week을 참조하지 않습니다.
    select
      proof.group_id,
      (private.study_date(proof.created_at) - week.start) as day_number,
      count(*) as approved
    from public.proofs proof, week
    where proof.verification_status in
        ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')
      and private.study_date(proof.created_at) >= week.start
      and private.study_date(proof.created_at) < week.start + 7
    group by proof.group_id, day_number
  ), entries as (
    select
      study_group.id,
      study_group.name,
      study_group.slug,
      study_group.is_public,
      (
        select count(*)
        from public.group_members member
        where member.group_id = study_group.id
          and member.status = 'ACTIVE'
      ) as member_count,
      (
        select coalesce(sum(daily.approved), 0)
        from daily
        where daily.group_id = study_group.id
      ) as week_approved,
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', (select start from week) + series.day_number,
            'approved', coalesce(daily.approved, 0)
          )
          order by series.day_number
        )
        from generate_series(0, 6) as series(day_number)
        left join daily on daily.group_id = study_group.id
          and daily.day_number = series.day_number
      ) as days
    from public.groups study_group
    order by study_group.created_at desc
    limit 100
  )
  select jsonb_build_object(
    'today', (select today from week),
    'weekStart', (select start from week),
    'totalMembers', (select coalesce(sum(member_count), 0) from entries),
    'weekApproved', (
      select coalesce(sum(week_approved), 0) from entries where is_public
    ),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', entries.name,
          'slug', entries.slug,
          'isPublic', entries.is_public,
          'memberCount', entries.member_count,
          'weekApproved',
            case when entries.is_public then entries.week_approved end,
          'days', case when entries.is_public then entries.days end
        )
        order by entries.is_public desc, entries.member_count desc, entries.name
      )
      from entries
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_public_group_board(group_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', study_group.name,
    'slug', study_group.slug,
    'weekStart', date_trunc('week', private.study_date(now()))::date,
    'memberCount', (
      select count(*)
      from public.group_members member
      where member.group_id = study_group.id
        and member.status = 'ACTIVE'
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'displayName', board.display_name,
          'weekApproved', board.week_approved,
          'totalApproved', board.total_approved
        )
        order by board.total_approved desc, board.week_approved desc, board.display_name
      )
      from (
        select
          profile.display_name,
          count(proof.id) filter (
            where proof.verification_status in
              ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')
              and private.study_date(proof.created_at)
                >= date_trunc('week', private.study_date(now()))::date
          ) as week_approved,
          count(proof.id) filter (
            where proof.verification_status in
              ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')
          ) as total_approved
        from public.group_members member
        join public.profiles profile on profile.id = member.user_id
        left join public.proofs proof
          on proof.group_id = member.group_id
          and proof.user_id = member.user_id
        where member.group_id = study_group.id
          and member.status = 'ACTIVE'
        group by member.user_id, profile.display_name
      ) board
    ), '[]'::jsonb)
  )
  from public.groups study_group
  where study_group.slug = group_slug
    and study_group.is_public;
$$;

revoke all on function public.get_group_overview(uuid, date) from public, anon, authenticated;
grant execute on function public.get_group_overview(uuid, date) to authenticated;

revoke all on function public.get_group_directory() from public;
grant execute on function public.get_group_directory() to anon, authenticated;

revoke all on function public.get_public_group_board(text) from public;
grant execute on function public.get_public_group_board(text) to anon, authenticated;

commit;
