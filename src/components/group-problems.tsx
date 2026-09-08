import { updateProblemTitleAction } from "@/app/actions/proofs";
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
  groupSlug,
  canEditTitle,
}: {
  rows: ProblemProofRow[];
  profileById: Map<string, { display_name: string }>;
  currentUserId: string;
  groupSlug: string;
  canEditTitle: boolean;
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
                {canEditTitle && (
                  // 스크립트 없이도 열고 닫히도록 details를 씁니다.
                  <details className="px-4 pb-3">
                    <summary className="inline-block cursor-pointer list-none text-[13px] text-sub underline [&::-webkit-details-marker]:hidden">
                      {problem.title ? "제목 수정" : "제목 넣기"}
                    </summary>
                    <form
                      action={updateProblemTitleAction}
                      className="mt-2 flex items-center gap-2"
                    >
                      <input type="hidden" name="groupSlug" value={groupSlug} />
                      <input
                        type="hidden"
                        name="problemUrl"
                        value={problem.url}
                      />
                      <input
                        type="text"
                        name="title"
                        defaultValue={problem.title}
                        maxLength={160}
                        placeholder="문제 제목"
                        aria-label={`${problem.title || problem.url} 제목`}
                        className="min-w-0 flex-1"
                      />
                      <button type="submit" className="btn">
                        저장
                      </button>
                    </form>
                  </details>
                )}
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
      {canEditTitle && problems.length > 0 && (
        <p className="mt-2 text-[13px] text-sub">
          제목은 같은 링크를 남긴 그룹의 모든 기록에 함께 적용됩니다.
        </p>
      )}
    </section>
  );
}
