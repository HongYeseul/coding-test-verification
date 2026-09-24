import test from "node:test";
import assert from "node:assert/strict";

import { solutionFiles } from "../extension/solution-files.js";

/**
 * GitHub 저장소에 올릴 파일의 자리와 내용을 봅니다.
 *
 * README에는 제목·플랫폼·링크·태그만 들어가야 합니다. 문제 설명 같은 플랫폼 콘텐츠를
 * 옮기지 않는다는 약속을 여기서 모양으로 붙잡아 둡니다.
 */
const PROGRAMMERS =
  "https://school.programmers.co.kr/learn/courses/30/lessons/42576";
const NEETCODE = "https://neetcode.io/problems/duplicate-integer";

test("프로그래머스 풀이는 번호와 제목으로 된 폴더에 코드와 README를 한 벌로 둔다", () => {
  const solution = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "완주하지 못한 선수",
    language: "python3",
    code: "def solution(participant, completion):\n    return ''",
    tags: "해시, 정렬",
  });

  assert.equal(solution.folder, "프로그래머스/42576. 완주하지 못한 선수");
  assert.equal(solution.message, "[프로그래머스] 완주하지 못한 선수");
  assert.deepEqual(solution.files, [
    {
      path: "프로그래머스/42576. 완주하지 못한 선수/solution.py",
      // 끝 줄바꿈이 없으면 붙입니다.
      content: "def solution(participant, completion):\n    return ''\n",
    },
    {
      path: "프로그래머스/42576. 완주하지 못한 선수/README.md",
      content: [
        "# 완주하지 못한 선수",
        "",
        "- 플랫폼: 프로그래머스",
        `- 문제: ${PROGRAMMERS}`,
        "- 태그: 해시, 정렬",
        "",
      ].join("\n"),
    },
  ]);
});

test("NeetCode 풀이는 슬러그를 폴더 이름으로 쓴다", () => {
  const solution = solutionFiles({
    problemUrl: NEETCODE,
    title: "Contains Duplicate",
    language: "python",
    code: "class Solution:\n    pass\n",
    tags: "",
  });

  assert.equal(solution.folder, "NeetCode/duplicate-integer");
  assert.equal(solution.message, "[NeetCode] Contains Duplicate");
  assert.deepEqual(
    solution.files.map((file) => file.path),
    ["NeetCode/duplicate-integer/solution.py", "NeetCode/duplicate-integer/README.md"],
  );
  // 태그가 없으면 줄도 없습니다.
  assert.doesNotMatch(solution.files[1].content, /태그/);
});

test("파일 이름은 언어를 따르고, 모르는 언어는 코드를 잃지 않도록 txt로 둔다", () => {
  const file = (language) =>
    solutionFiles({ problemUrl: PROGRAMMERS, title: "", language, code: "x", tags: "" })
      .files[0].path.split("/")
      .pop();

  assert.equal(file("java"), "Solution.java");
  assert.equal(file("cpp"), "solution.cpp");
  assert.equal(file("javascript"), "solution.js");
  assert.equal(file("kotlin"), "solution.kt");
  assert.equal(file("mysql"), "solution.sql");
  assert.equal(file("Python3"), "solution.py");
  assert.equal(file("brainfuck"), "solution.txt");
  assert.equal(file(""), "solution.txt");
  assert.equal(file(undefined), "solution.txt");
});

test("제목에서 경로로 쓸 수 없는 글자를 걷어 낸다", () => {
  const solution = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "[PCCP 기출문제] 1번 / 붕대 감기",
    language: "java",
    code: "class Solution {}",
    tags: "",
  });

  assert.equal(solution.folder, "프로그래머스/42576. [PCCP 기출문제] 1번 붕대 감기");
  // README 제목과 커밋 메시지는 원래 제목을 그대로 씁니다.
  assert.equal(solution.message, "[프로그래머스] [PCCP 기출문제] 1번 / 붕대 감기");
  assert.match(solution.files[1].content, /^# \[PCCP 기출문제\] 1번 \/ 붕대 감기\n/);
});

test("제목이 없으면 번호만으로 폴더를 짓는다", () => {
  const solution = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "  ",
    language: "c",
    code: "int main() {}",
    tags: "",
  });

  assert.equal(solution.folder, "프로그래머스/42576");
  assert.equal(solution.message, "[프로그래머스] 42576");
  assert.match(solution.files[1].content, /^# 42576\n/);
});

test("지원하지 않는 주소나 빈 코드는 올릴 자리를 정하지 않는다", () => {
  const base = { title: "t", language: "python3", code: "x", tags: "" };
  for (const problemUrl of [
    "https://leetcode.com/problems/two-sum",
    "https://school.programmers.co.kr/learn/courses/30/lessons/../../etc",
    "https://neetcode.io/problems/..%2F..%2Fetc",
    "https://neetcode.io/problems/duplicate-integer/question",
    "잘못된 주소",
    "",
  ]) {
    assert.equal(solutionFiles({ ...base, problemUrl }), null, problemUrl);
  }
  assert.equal(solutionFiles({ ...base, problemUrl: PROGRAMMERS, code: " \n" }), null);
});

test("README에는 제목·플랫폼·링크·태그 말고는 아무것도 적지 않는다", () => {
  const readme = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "완주하지 못한 선수",
    language: "python3",
    code: "x",
    tags: "해시",
  }).files[1].content;

  const lines = readme.split("\n").filter(Boolean);
  assert.deepEqual(
    lines.map((line) => line.split(":")[0]),
    ["# 완주하지 못한 선수", "- 플랫폼", "- 문제", "- 태그"],
  );
});
