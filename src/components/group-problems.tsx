import { groupSolvedProblems, type ProblemProofRow } from "@/lib/group-problems";

/** 이름을 세 명까지 보여주고 나머지는 인원수로 줄입니다. */
function solverNames(
  ids: string[],
  profileById: Map<string, { display_name: string }>,
) {
  const names = ids.map((id) => profileById.get(id)?.display_name ?? "멤버");
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
  profileById: Map<string, { display_name: string }>;
  currentUserId: string;
}) {
  const problems = groupSolvedProblems(rows);

  return (
    <section aria-labelledby="group-problems-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="group-problems-title">우리 그룹이 푼 문제</h2>
        <span className="text-xs text-sub tabular-nums">
          링크를 남긴 {problems.length}문제
        </span>
      </div>

      {problems.length ? (
        <ul className="rounded-xl border border-line">
          {problems.map((problem) => {
            const solvedByMe = problem.solverIds.includes(currentUserId);
            return (
              <li
                key={problem.url}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-sub">
                      {problem.platform}
                    </span>
                    <p className="truncate text-[13px] font-semibold">
                      {problem.title || problem.url.replace("https://", "")}
                    </p>
                  </div>
                  <p className="mt-[3px] text-xs text-sub">
                    {solverNames(problem.solverIds, profileById)} 등록
                    {solvedByMe ? " · 나도 등록함" : ""}
                  </p>
                </div>
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn shrink-0"
                >
                  풀어보기 ↗
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-line px-5 py-10 text-center text-xs text-sub">
          아직 문제 링크가 없습니다. 풀이를 등록할 때 문제 링크를 넣으면 여기에
          모입니다.
        </p>
      )}
    </section>
  );
}
