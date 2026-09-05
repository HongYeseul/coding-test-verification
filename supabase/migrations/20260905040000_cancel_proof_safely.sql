alter table public.proofs drop constraint proofs_verification_status_check;
alter table public.proofs add constraint proofs_verification_status_check
check (verification_status in ('PENDING','MANUAL_REVIEWED','API_VERIFIED','REJECTED','CANCELING'));

create or replace function private.validate_proof()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.platform_account_id is not null and not exists (
    select 1 from public.platform_accounts where id = new.platform_account_id and user_id = new.user_id
  ) then raise exception '본인의 플랫폼 계정만 사용할 수 있습니다.'; end if;
  if new.evidence_path is not null and not (
    new.evidence_path like new.group_id::text || '/' || new.user_id::text || '/%'
    and array_length(string_to_array(new.evidence_path, '/'), 1) = 3
    and split_part(new.evidence_path, '/', 3) <> ''
  ) then raise exception '증빙 파일 경로가 올바르지 않습니다.'; end if;
  if new.platform_account_id is null and new.verification_status <> 'CANCELING' then
    if not exists (
      select 1 from storage.objects where bucket_id = 'proof-evidence' and name = new.evidence_path
        and metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
        and (metadata->>'size')::bigint between 1 and 6291456
    ) then raise exception '업로드한 사진을 확인해주세요.'; end if;
  end if;
  return new;
end;
$$;

create or replace function private.can_delete_evidence_path(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare folders text[];
begin
  folders := storage.foldername(object_name);
  return array_length(folders,1)=2 and folders[2]=auth.uid()::text
    and private.is_active_group_member(folders[1]::uuid)
    and not exists (select 1 from public.proofs where evidence_path=object_name
      and (verification_status <> 'CANCELING' or user_id <> auth.uid()));
exception when invalid_text_representation then return false;
end;
$$;

create function public.begin_proof_cancellation(target_group_id uuid, target_proof_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare proof public.proofs%rowtype;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 멤버만 취소할 수 있습니다.' using errcode='42501';
  end if;
  select * into proof from public.proofs where id=target_proof_id
    and group_id=target_group_id and user_id=auth.uid() for update;
  if not found then return null; end if;
  if proof.verification_status not in ('PENDING','CANCELING') then
    raise exception '검수 대기 중인 본인 기록만 취소할 수 있습니다.' using errcode='42501';
  end if;
  if proof.verification_status='PENDING' then
    update public.proofs set verification_status='CANCELING' where id=proof.id;
  end if;
  return jsonb_build_object('id',proof.id,'evidence_path',proof.evidence_path);
end;
$$;

create function public.finish_proof_cancellation(target_group_id uuid, target_proof_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare proof public.proofs%rowtype;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 멤버만 취소할 수 있습니다.' using errcode='42501';
  end if;
  select * into proof from public.proofs where id=target_proof_id
    and group_id=target_group_id and user_id=auth.uid() for update;
  if not found then return; end if;
  if proof.verification_status <> 'CANCELING' then
    raise exception '취소 처리 중인 기록이 아닙니다.' using errcode='42501';
  end if;
  if proof.evidence_path is not null and exists (
    select 1 from storage.objects where bucket_id='proof-evidence' and name=proof.evidence_path
  ) then raise exception '사진 삭제를 다시 시도해주세요.'; end if;
  delete from public.proofs where id=proof.id;
end;
$$;
revoke delete on public.proofs from authenticated;
revoke all on function public.begin_proof_cancellation(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_proof_cancellation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_proof_cancellation(uuid,uuid) to authenticated;
grant execute on function public.finish_proof_cancellation(uuid,uuid) to authenticated;

create or replace function public.get_group_overview(target_group_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  week_start date := date_trunc('week', now() at time zone 'Asia/Seoul')::date;
  result jsonb;
begin
  if not private.is_active_group_member(target_group_id) then
    raise exception '활성 그룹 멤버만 현황판을 볼 수 있습니다.' using errcode = '42501';
  end if;

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
      and proof.verification_status <> 'CANCELING'
  ), totals as (
    select user_id,
      count(*) filter (where registered_date = today_kst and verification_status <> 'REJECTED') as today_submitted,
      count(*) filter (where registered_date >= week_start and verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as week_approved,
      count(*) filter (where verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as total_approved,
      count(*) filter (where verification_status = 'PENDING') as pending
    from records group by user_id
  ), daily as (
    select user_id, registered_date,
      count(*) filter (where verification_status in ('MANUAL_REVIEWED', 'API_VERIFIED')) as approved,
      count(*) filter (where verification_status = 'PENDING') as pending,
      count(*) filter (where verification_status = 'REJECTED') as rejected
    from records where registered_date >= week_start group by user_id, registered_date
  )
  select jsonb_build_object(
    'today', today_kst, 'weekStart', week_start,
    'days', (select jsonb_agg(week_start + day_number order by day_number) from generate_series(0, 6) as day_number),
    'members', coalesce(jsonb_agg(jsonb_build_object(
      'userId', member.user_id, 'displayName', member.display_name, 'role', member.role,
      'todaySubmitted', coalesce(totals.today_submitted, 0),
      'weekApproved', coalesce(totals.week_approved, 0),
      'totalApproved', coalesce(totals.total_approved, 0), 'pending', coalesce(totals.pending, 0),
      'days', (select jsonb_agg(jsonb_build_object(
        'date', week_start + day_number,
        'approved', coalesce(daily.approved, 0), 'pending', coalesce(daily.pending, 0), 'rejected', coalesce(daily.rejected, 0)
      ) order by day_number) from generate_series(0, 6) as day_number
      left join daily on daily.user_id = member.user_id and daily.registered_date = week_start + day_number)
    ) order by member.display_name, member.user_id), '[]'::jsonb)
  ) into result from members member left join totals on totals.user_id = member.user_id;
  return result;
end;
$$;
revoke all on function public.get_group_overview(uuid) from public, anon, authenticated;
grant execute on function public.get_group_overview(uuid) to authenticated;
