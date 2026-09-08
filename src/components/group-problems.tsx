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
        <span className="text-[13px] text-sub tabular-nums">
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
                className="border-b border-line last:border-b-0"
              >
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group/problem block px-4 py-3 hover:bg-soft"
                >
                  <span className="mb-1 block">
                    <span className="rounded-full bg-soft px-2 py-0.5 text-[12px] text-sub">
                      {problem.platform}
                    </span>
                  </span>
                  <span className="block text-[16px] font-semibold group-hover/problem:underline">
                    {problem.title || problem.url.replace("https://", "")}
                    <span aria-hidden="true" className="ml-1 text-[13px] text-sub">
                      ↗
                    </span>
                  </span>
                  <span className="mt-1 block text-[13px] text-sub">
                    {solverNames(problem.solverIds, profileById)} 등록
                    {solvedByMe ? " · 나도 등록함" : ""}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-line px-5 py-10 text-center text-[13px] text-sub">
          아직 문제 링크가 없습니다. 풀이를 등록할 때 문제 링크를 넣으면 여기에
          모입니다.
        </p>
      )}
    </section>
  );
}
