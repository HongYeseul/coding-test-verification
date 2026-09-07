-- 멤버가 닉네임과 한 줄 소개를 직접 설정할 수 있게 합니다.
-- 닉네임이 바뀌어도 누구인지 확인할 수 있도록 GitHub 아이디를 프로필에 보관하며,
-- 이 값은 사용자가 아니라 auth.identities에서만 채웁니다.
begin;

alter table public.profiles
  add column github_login text,
  add column bio text;

-- 닉네임이 사용자 입력이 되므로 앞뒤 공백과 제어문자를 DB에서도 막습니다.
-- 기존 CHECK는 공백만으로 이루어진 이름을 통과시켰습니다.
alter table public.profiles drop constraint profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check check (
  display_name = btrim(display_name)
  and char_length(display_name) between 1 and 40
  and display_name !~ '[[:cntrl:]]'
);

alter table public.profiles add constraint profiles_bio_check check (
  bio is null or (
    bio = btrim(bio)
    and char_length(bio) between 1 and 80
    and bio !~ '[[:cntrl:]]'
  )
);

-- GitHub 아이디 규칙: 영숫자와 홑하이픈, 하이픈으로 시작하거나 끝나지 않고 39자 이하.
alter table public.profiles add constraint profiles_github_login_check check (
  github_login is null or github_login ~ '^[a-z0-9](?:-?[a-z0-9]){0,38}$'
);

-- 기존 사용자의 GitHub 아이디를 채웁니다. 계정마다 먼저 연결된 identity를 씁니다.
update public.profiles profile
set github_login = identity.login
from (
  select distinct on (source.user_id)
    source.user_id,
    lower(nullif(coalesce(
      source.identity_data ->> 'user_name',
      source.identity_data ->> 'preferred_username'
    ), '')) as login
  from auth.identities source
  where source.provider = 'github'
  order by source.user_id, source.created_at
) identity
where profile.id = identity.user_id
  and identity.login is not null;

-- 신규 가입과 GitHub 아이디 변경을 따라갑니다.
-- auth.identities는 profiles보다 뒤에 생기므로 여기서 UPDATE로 채웁니다.
create or replace function private.sync_github_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider <> 'github' then
    return new;
  end if;

  update public.profiles
  set github_login = lower(nullif(coalesce(
    new.identity_data ->> 'user_name',
    new.identity_data ->> 'preferred_username'
  ), ''))
  where id = new.user_id;

  return new;
end;
$$;

revoke all on function private.sync_github_login() from public, anon, authenticated;

create trigger on_auth_identity_github_synced
after insert or update of identity_data on auth.identities
for each row execute function private.sync_github_login();

-- RLS는 행 단위라 컬럼을 막지 못합니다.
-- 본인 행이라도 github_login과 avatar_url은 바꿀 수 없도록 컬럼 단위로 권한을 좁힙니다.
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, bio) on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;

-- 현황판이 닉네임과 함께 GitHub 아이디·한 줄 소개를 내려주도록 members에 두 값을 더합니다.
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
