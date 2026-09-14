-- 그룹 화면 오른쪽이 비어 있었습니다. 도장판은 ‘무엇이 쌓였나’를 보여주지만
-- ‘방금 무슨 일이 있었나’는 어디에도 없었습니다. 서로 독려하는 서비스에서
-- 그 자리가 비어 있으면 혼자 쓰는 장부처럼 느껴집니다.
begin;

-- 퇴근한 순간입니다. record_minutes만으로는 언제 일어났는지 알 수 없습니다 —
-- 착석 시각에 시간을 더하면 나오지만, 그건 계산한 값이지 일어난 사건이 아닙니다.
alter table public.proofs add column finished_at timestamptz;

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

  update public.proofs
  set record_minutes = duration, finished_at = now()
  where id = proof.id;
  return jsonb_build_object(
    'startMinutes', proof.start_minutes,
    'recordMinutes', duration
  );
end;
$$;

revoke all on function public.finish_seat_record(uuid, integer) from public, anon, authenticated;
grant execute on function public.finish_seat_record(uuid, integer) to authenticated;

/**
 * 그룹의 최근 활동입니다. 도장·퇴근·응원·검수를 시간순으로 한 줄에 모읍니다.
 *
 * security invoker라 네 표의 RLS가 그대로 걸립니다. 활성 멤버가 아니면
 * 애초에 아무것도 보이지 않지만, 빈 목록과 권한 없음을 가르려고 먼저 확인합니다.
 * 문장은 화면이 만듭니다 — 말을 바꾸려고 마이그레이션을 하지 않게 하려는 것입니다.
 */
create or replace function public.get_group_activity(
  target_group_id uuid,
  target_limit integer default 20
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  capped integer := least(greatest(coalesce(target_limit, 20), 1), 50);
  result jsonb;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 그룹 멤버만 활동을 볼 수 있습니다.' using errcode = '42501';
  end if;

  with events as (
    -- 도장을 찍은 순간. 그룹의 기록 종류에 따라 무엇을 남겼는지가 갈립니다.
    select proof.created_at as at,
      case
        when proof.start_minutes is not null then 'SEAT_START'
        when proof.record_minutes is not null
          and study_group.record_kind = 'CLOCK' then 'CLOCK'
        else 'STAMP'
      end as kind,
      proof.user_id as actor_id,
      null::uuid as target_id,
      coalesce(proof.start_minutes, proof.record_minutes) as minutes,
      null::text as note,
      proof.id as proof_id
    from public.proofs proof
    join public.groups study_group on study_group.id = proof.group_id
    where proof.group_id = target_group_id
      and proof.verification_status <> 'CANCELING'
      and proof.created_at <= now()
    union all
    -- 퇴근한 순간
    select proof.finished_at, 'SEAT_END', proof.user_id, null::uuid,
      proof.record_minutes, null::text, proof.id
    from public.proofs proof
    where proof.group_id = target_group_id
      and proof.finished_at is not null
      and proof.verification_status <> 'CANCELING'
    union all
    -- 응원
    select cheer.created_at, 'CHEER', cheer.user_id, proof.user_id,
      null::integer, null::text, proof.id
    from public.proof_cheers cheer
    join public.proofs proof on proof.id = cheer.proof_id
    where proof.group_id = target_group_id
    union all
    -- 검수. 반려 이유는 그대로 싣고 화면이 인용합니다.
    select review.created_at,
      case when review.decision = 'APPROVED' then 'APPROVED' else 'REJECTED' end,
      review.reviewer_id, proof.user_id, null::integer, review.note, proof.id
    from public.proof_reviews review
    join public.proofs proof on proof.id = review.proof_id
    where proof.group_id = target_group_id
  ), recent as (
    select * from events order by at desc limit capped
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'at', recent.at,
    'kind', recent.kind,
    'actorName', actor.display_name,
    'targetName', target.display_name,
    'minutes', recent.minutes,
    'note', recent.note,
    'proofId', recent.proof_id
  ) order by recent.at desc), '[]'::jsonb)
  into result
  from recent
  join public.profiles actor on actor.id = recent.actor_id
  left join public.profiles target on target.id = recent.target_id;
  return result;
end;
$$;

revoke all on function public.get_group_activity(uuid, integer) from public, anon, authenticated;
grant execute on function public.get_group_activity(uuid, integer) to authenticated;

commit;
