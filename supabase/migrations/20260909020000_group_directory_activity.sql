-- 첫 화면 목록이 '활동 중'을 말하려면 인원수만으로는 부족해 이번 주 활동을 함께 내려줍니다.
-- 요일별 인증 여부까지 주므로 그룹 화면의 주간 인증 매트릭스를 목록에서도 같은 모양으로 보여줍니다.
-- 비공개 그룹은 이름과 인원수까지만 공개하므로 그룹별 활동도, 합계의 활동량도 공개 그룹만 셉니다.
-- 그룹이 하나뿐일 때 합계로 비공개 그룹의 활동이 역산되지 않게 하려는 것입니다.
--
-- 배열을 돌려주던 list_group_directory()를 고치지 않고 이름이 다른 함수를 새로 만듭니다.
-- 배포 전에 적용해도 구버전 화면이 빈 목록으로 보이지 않게 하려는 것이며,
-- 배포가 끝나면 20260909030000에서 옛 함수를 지웁니다.
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
      date_trunc('week', now() at time zone 'Asia/Seoul')::date as start,
      (now() at time zone 'Asia/Seoul')::date as today
  ), daily as (
    -- 요일 번호를 여기서 계산해야 아래 LEFT JOIN의 ON에서 week을 참조하지 않습니다.
    select
      proof.group_id,
      ((proof.created_at at time zone 'Asia/Seoul')::date - week.start) as day_number,
      count(*) as approved
    from public.proofs proof, week
    where proof.verification_status in
        ('AUTO_APPROVED', 'MANUAL_REVIEWED', 'API_VERIFIED')
      and (proof.created_at at time zone 'Asia/Seoul')::date >= week.start
      and (proof.created_at at time zone 'Asia/Seoul')::date < week.start + 7
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

revoke all on function public.get_group_directory() from public;
grant execute on function public.get_group_directory() to anon, authenticated;

commit;
