-- 제목 없이 올린 문제는 목록에 링크만 보이므로 소유자와 검수자가 제목을 고칠 수 있게 합니다.
-- 목록이 같은 링크를 한 문제로 묶으므로 제목도 그룹 안의 같은 링크 기록이 함께 갖습니다.
begin;

-- 앱만 확인하던 제목 길이를 새 쓰기 경로가 생긴 김에 DB에서도 확인합니다.
alter table public.proofs add constraint proofs_problem_title_check check (
  problem_title is null or char_length(problem_title) between 1 and 160
);

-- RLS는 행 단위라 컬럼을 막지 못합니다.
-- 검수자가 제목만 고치고 상태나 사진 경로는 바꾸지 못하도록 컬럼 단위로 권한을 좁힙니다.
grant update (problem_title) on public.proofs to authenticated;

create policy proofs_update_title_reviewer
on public.proofs for update to authenticated
using (private.can_review_group(group_id))
with check (private.can_review_group(group_id));

commit;
