-- 제목 없이 올린 문제는 목록에 링크만 보이므로 소유자와 검수자가 그룹 제목을 정할 수 있게 합니다.
-- 제목을 기록(proofs)에 덮어쓰면 남의 기록까지 바뀌므로 그룹 단위로 따로 보관합니다.
-- 덕분에 proofs는 지금처럼 INSERT 전용으로 남습니다.
begin;

create table public.group_problem_titles (
  group_id uuid not null references public.groups (id) on delete cascade,
  -- 링크가 문제의 식별자입니다. 제목은 바뀌어도 이 값은 그대로입니다.
  -- 앱이 정규화한 형태(쿼리·프래그먼트·끝 슬래시 없음)만 받아 같은 문제가 두 행이 되지 않게 합니다.
  url text not null check (
    url like 'https://%'
    and url not like '%/'
    and url !~ '[?#]'
    and char_length(url) <= 500
  ),
  title text not null check (
    title = btrim(title)
    and char_length(title) between 1 and 160
    and title !~ '[[:cntrl:]]'
  ),
  updated_by uuid not null references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(),
  -- 같은 문제라도 그룹마다 다른 제목을 붙일 수 있어야 하므로 그룹까지 키에 넣습니다.
  primary key (group_id, url)
);

create trigger group_problem_titles_touch_updated_at
before update on public.group_problem_titles
for each row execute function private.touch_updated_at();

alter table public.group_problem_titles enable row level security;

create policy group_problem_titles_select_member
on public.group_problem_titles for select to authenticated
using (private.is_active_group_member(group_id));

create policy group_problem_titles_insert_reviewer
on public.group_problem_titles for insert to authenticated
with check (
  private.can_review_group(group_id)
  and updated_by = (select auth.uid())
);

create policy group_problem_titles_update_reviewer
on public.group_problem_titles for update to authenticated
using (private.can_review_group(group_id))
with check (
  private.can_review_group(group_id)
  and updated_by = (select auth.uid())
);

-- 제목을 비우면 행을 지워 기록에 적힌 제목으로 되돌립니다.
create policy group_problem_titles_delete_reviewer
on public.group_problem_titles for delete to authenticated
using (private.can_review_group(group_id));

revoke all on table public.group_problem_titles from anon, authenticated;
grant select, insert, update, delete on table public.group_problem_titles to authenticated;

commit;
