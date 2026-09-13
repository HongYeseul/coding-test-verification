-- 응원. 검수 권한이 없는 멤버도 기록에 남길 수 있는 유일한 반응입니다.
-- 하트 하나뿐이고 검수도 집계도 아닙니다 — 인증의 무게를 가볍게 만들지 않으려는 선입니다.
begin;

create table public.proof_cheers (
  proof_id uuid not null references public.proofs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (proof_id, user_id)
);

alter table public.proof_cheers enable row level security;

-- 그룹의 활성 멤버만 봅니다. 기록을 볼 수 있는 사람과 같은 범위입니다.
create policy proof_cheers_select_member
on public.proof_cheers for select to authenticated
using (
  exists (
    select 1
    from public.proofs proof
    where proof.id = proof_id
      and private.is_active_group_member(proof.group_id)
  )
);

-- 남의 기록에만, 취소 중이 아닌 기록에만 남깁니다.
create policy proof_cheers_insert_self
on public.proof_cheers for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.proofs proof
    where proof.id = proof_id
      and proof.user_id <> (select auth.uid())
      and proof.verification_status <> 'CANCELING'
      and private.is_active_group_member(proof.group_id)
  )
);

-- 내가 남긴 응원은 내가 거둡니다.
create policy proof_cheers_delete_self
on public.proof_cheers for delete to authenticated
using (user_id = (select auth.uid()));

-- 기본 권한을 먼저 거두고 필요한 것만 엽니다. UPDATE는 정책도 권한도 없습니다.
revoke all on table public.proof_cheers from anon, authenticated;
grant select, insert, delete on table public.proof_cheers to authenticated;

commit;
