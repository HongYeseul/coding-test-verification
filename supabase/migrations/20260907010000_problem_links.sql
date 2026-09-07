-- 사진 인증에도 문제 링크를 남겨 다른 멤버가 같은 문제를 풀어볼 수 있게 합니다.
-- 허용 플랫폼 호스트는 저장할 때와 보여줄 때 모두 앱에서 확인합니다.
begin;

alter table public.proofs add constraint proofs_problem_url_format
  check (
    problem_url is null
    or (problem_url like 'https://%' and char_length(problem_url) <= 500)
  );

-- 그룹 문제 목록을 최근 등록순으로 읽기 위한 부분 인덱스입니다.
create index proofs_group_problem_url_idx
  on public.proofs (group_id, created_at desc)
  where problem_url is not null;

commit;
