import { problemLink } from "./proof-input.ts";

export type ProblemProofRow = {
  problem_url: string | null;
  problem_title: string | null;
  user_id: string;
  created_at: string;
};

export type SolvedProblem = {
  url: string;
  platform: string;
  title: string;
  solverIds: string[];
  latestAt: string;
};

/** 같은 문제 링크를 하나로 묶고 최근에 등록된 문제부터 보여줍니다. */
export function groupSolvedProblems(rows: ProblemProofRow[]): SolvedProblem[] {
  const problems = new Map<string, SolvedProblem>();
  for (const row of rows) {
    const link = problemLink(row.problem_url);
    if (!link) continue;
    const title = row.problem_title?.trim() ?? "";
    const found = problems.get(link.url);
    if (!found) {
      problems.set(link.url, {
        url: link.url,
        platform: link.platform,
        title,
        solverIds: [row.user_id],
        latestAt: row.created_at,
      });
      continue;
    }
    // 먼저 등록한 사람이 제목을 비워뒀다면 다음 기록의 제목을 씁니다.
    if (!found.title && title) found.title = title;
    if (!found.solverIds.includes(row.user_id))
      found.solverIds.push(row.user_id);
    if (row.created_at > found.latestAt) found.latestAt = row.created_at;
  }
  return [...problems.values()].sort((left, right) =>
    right.latestAt.localeCompare(left.latestAt),
  );
}
