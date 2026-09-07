import { groupSolvedProblems, type ProblemProofRow } from "@/lib/group-problems";

/** 이름을 세 명까지 보여주고 나머지는 인원수로 줄입니다. */
function solverNames(ids: string[], profileById: Map<string, string>) {
  const names = ids.map((id) => profileById.get(id) ?? "멤버");
  return names.length > 3
    ? `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}명`
    : names.join(", ");
}

export function GroupProblems({
  rows,
  profileById,
  currentUserId,
}: {
  rows: ProblemProofRow[];
  profileById: Map<string, string>;
  currentUserId: string;
}) {
  const problems = groupSolvedProblems(rows);

  return (
    <section
      aria-labelledby="group-problems-title"
      className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--muted)]">
            링크를 남긴 기록 · 반려·취소 제외
          </p>
          <h2 id="group-problems-title" className="mt-1 text-xl font-extrabold">
            우리 그룹이 푼 문제
          </h2>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-xs font-bold text-[var(--accent-ink)]">
          {problems.length} PROBLEMS
        </span>
      </div>

      {problems.length ? (
        <ul className="mt-5 space-y-3">
          {problems.map((problem) => {
            const solvedByMe = problem.solverIds.includes(currentUserId);
            return (
              <li
                key={problem.url}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs font-bold text-[var(--muted-strong)]">
                      {problem.platform}
                    </span>
                    <p className="truncate font-bold">
                      {problem.title || problem.url.replace("https://", "")}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--muted)]">
                    {solverNames(problem.solverIds, profileById)} 등록
                    {solvedByMe ? " · 나도 등록함" : ""}
                  </p>
                </div>
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className={
                    solvedByMe
                      ? "shrink-0 rounded-xl border border-[var(--line-strong)] px-4 py-2 text-sm font-bold text-[var(--muted-strong)]"
                      : "shrink-0 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white"
                  }
                >
                  풀어보기 ↗
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl bg-[var(--surface-subtle)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          아직 문제 링크가 없습니다. 풀이를 등록할 때 문제 링크를 넣으면 여기에
          모입니다.
        </p>
      )}
    </section>
  );
}
