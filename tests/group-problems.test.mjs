import test from "node:test";
import assert from "node:assert/strict";
import { groupSolvedProblems } from "../src/lib/group-problems.ts";

const twoSum = "https://leetcode.com/problems/two-sum";

test("같은 문제를 푼 멤버를 하나로 묶고 최근 등록 순으로 정렬한다", () => {
  const problems = groupSolvedProblems([
    {
      problem_url: "https://www.acmicpc.net/problem/1000/",
      problem_title: "A+B",
      user_id: "yeseul",
      created_at: "2026-09-07T03:00:00Z",
    },
    {
      problem_url: `${twoSum}?language=python3`,
      problem_title: "",
      user_id: "minsu",
      created_at: "2026-09-06T02:00:00Z",
    },
    {
      problem_url: `${twoSum}#solution`,
      problem_title: "두 수의 합",
      user_id: "yeseul",
      created_at: "2026-09-05T01:00:00Z",
    },
  ]);

  assert.deepEqual(
    problems.map((problem) => problem.url),
    ["https://acmicpc.net/problem/1000", twoSum],
  );
  const [, leetcode] = problems;
  assert.deepEqual(leetcode.solverIds, ["minsu", "yeseul"]);
  // 먼저 등록한 사람이 제목을 비워뒀으면 다음 기록의 제목을 씁니다.
  assert.equal(leetcode.title, "두 수의 합");
  assert.equal(leetcode.platform, "LeetCode");
  assert.equal(leetcode.latestAt, "2026-09-06T02:00:00Z");
});

test("같은 사람이 같은 문제를 여러 번 등록해도 한 번만 센다", () => {
  const [problem] = groupSolvedProblems([
    {
      problem_url: twoSum,
      problem_title: "두 수의 합",
      user_id: "yeseul",
      created_at: "2026-09-07T03:00:00Z",
    },
    {
      problem_url: `${twoSum}/`,
      problem_title: "두 수의 합",
      user_id: "yeseul",
      created_at: "2026-09-05T01:00:00Z",
    },
  ]);
  assert.deepEqual(problem.solverIds, ["yeseul"]);
});

test("허용하지 않는 링크는 문제 목록에서 제외한다", () => {
  assert.deepEqual(
    groupSolvedProblems([
      {
        problem_url: "https://evil.com/problems/two-sum",
        problem_title: "가짜",
        user_id: "yeseul",
        created_at: "2026-09-07T03:00:00Z",
      },
      {
        problem_url: null,
        problem_title: "사진만",
        user_id: "minsu",
        created_at: "2026-09-07T02:00:00Z",
      },
    ]),
    [],
  );
});
