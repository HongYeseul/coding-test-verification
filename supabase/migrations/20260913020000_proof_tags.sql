-- 무엇을 했는지 한 줄 제목만으로는 나중에 훑기 어렵습니다.
-- 해시·DP 같은 주제를 태그로 달아 두면 그룹이 무엇을 연습해왔는지 보입니다.
begin;

-- CHECK에는 하위 질의를 쓸 수 없어 IMMUTABLE 함수로 검사합니다.
create or replace function private.valid_proof_tags(tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select tags is null or (
    cardinality(tags) between 1 and 5
    and (
      select bool_and(
        char_length(tag) between 1 and 20
        and tag !~ '[[:cntrl:]]'
        and btrim(tag) = tag
        and btrim(tag) <> ''
      )
      from unnest(tags) as tag
    )
  );
$$;

revoke all on function private.valid_proof_tags(text[]) from public, anon, authenticated;
grant execute on function private.valid_proof_tags(text[]) to authenticated;

alter table public.proofs
  add column tags text[]
  constraint proofs_tags_valid check (private.valid_proof_tags(tags));

-- 나중에 태그로 좁혀 보려면 필요한 인덱스입니다.
create index proofs_tags_idx on public.proofs using gin (tags)
  where tags is not null;

commit;
