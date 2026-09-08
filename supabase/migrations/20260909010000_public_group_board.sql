-- 로그인하지 않아도 그룹 목록을 보고, 공개로 연 그룹은 리더보드까지 볼 수 있게 합니다.
-- 테이블 권한은 그대로 잠가두고 필요한 값만 고르는 함수 두 개로만 공개합니다.
-- 이렇게 하면 노출면이 함수 시그니처로 고정돼 조인 실수로 사진 경로나 GitHub 아이디가 새지 않습니다.
begin;

alter table public.groups add column is_public boolean not null default false;

-- 목록에는 비공개 그룹도 이름과 인원수까지 나옵니다. 진입은 공개 그룹만 됩니다.
create or replace function public.list_group_directory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', directory.name,
        'slug', directory.slug,
        'memberCount', directory.member_count,
        'isPublic', directory.is_public
      )
      order by directory.member_count desc, directory.name
    ),
    '[]'::jsonb
  )
  from (
    select
      study_group.name,
      study_group.slug,
      study_group.is_public,
      (
        select count(*)
        from public.group_members member
        where member.group_id = study_group.id
          and member.status = 'ACTIVE'
      ) as member_count
    from public.groups study_group
    order by study_group.created_at desc
    limit 100
  ) directory;
$$;

-- 공개 그룹의 리더보드입니다. 닉네임과 승인 집계만 내보내고 비공개 그룹은 아무것도 돌려주지 않습니다.
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
    'weekStart', date_trunc('week', now() at time zone 'Asia/Seoul')::date,
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
              and (proof.created_at at time zone 'Asia/Seoul')::date
                >= date_trunc('week', now() at time zone 'Asia/Seoul')::date
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

revoke all on function public.list_group_directory() from public;
revoke all on function public.get_public_group_board(text) from public;
grant execute on function public.list_group_directory() to anon, authenticated;
grant execute on function public.get_public_group_board(text) to anon, authenticated;

commit;
