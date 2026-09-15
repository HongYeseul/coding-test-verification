-- 첫 화면의 집계 두 개를 고칩니다.
--
-- 멤버 수가 그룹별 인원을 그냥 더한 값이라, 두 스터디에 든 사람이 두 번 세어졌습니다.
-- 사람 수를 말하는 자리이므로 중복을 지웁니다.
--
-- 인증 횟수는 이번 주치만 세고 있었습니다. 첫 화면은 이 서비스가 얼마나 쌓였는지
-- 보여주는 자리라 누적으로 바꿉니다. 그룹 칸의 주간 점과 '이번 주 N번'은 그대로입니다.
--
-- 누적은 비공개 그룹까지 셉니다. 멤버 수가 이미 전체를 세고 있어 한쪽만 공개 그룹으로
-- 좁히면 같은 줄에서 기준이 엇갈립니다. 합계라 어느 그룹의 것인지는 드러나지 않습니다.
--
-- 본문은 20260910000000(스터디 하루 새벽 3시)의 정의에서 그대로 가져와 고쳤습니다.
-- 옛 정의에서 옮겨 쓰면 경계가 자정으로 되돌아갑니다.
begin;

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
    -- 한 사람이 여러 스터디에 들어 있어도 한 번만 셉니다.
    'totalMembers', (
      select count(distinct member.user_id)
      from public.group_members member
      join entries on entries.id = member.group_id
      where member.status = 'ACTIVE'
    ),
    -- 서비스를 연 뒤 쌓인 전체 인증입니다.
    'totalApproved', (
      select count(*)
      from public.proofs proof
      join entries on entries.id = proof.group_id
      where proof.verification_status in
        ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')
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

commit;
