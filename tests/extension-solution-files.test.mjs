import test from "node:test";
import assert from "node:assert/strict";

import { gradingSummary, solutionFiles } from "../extension/solution-files.js";

/**
 * GitHub 저장소에 올릴 파일의 자리와 내용, 커밋 메시지를 봅니다.
 *
 * README에는 제목·플랫폼·난이도·링크·태그만 들어가야 합니다. 문제 설명 같은 플랫폼 콘텐츠를
 * 옮기지 않는다는 약속을 여기서 모양으로 붙잡아 둡니다.
 */
const PROGRAMMERS =
  "https://school.programmers.co.kr/learn/courses/30/lessons/42746";
const NEETCODE = "https://neetcode.io/problems/duplicate-integer";

/** 프로그래머스 채점 표의 통과 칸 글자입니다. 백준허브가 읽는 것과 같은 칸입니다. */
const CELLS = [
  "통과 (0.02ms, 10.2MB)",
  "통과 (64.31ms, 88.1MB)",
  "통과 (12.50ms, 96.4MB)",
];

test("프로그래머스 풀이는 번호와 제목으로 된 폴더에 코드와 README를 한 벌로 둔다", () => {
  const solution = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "가장 큰 수",
    language: "python3",
    code: "def solution(numbers):\n    return ''",
    tags: "정렬",
    level: "2",
    grading: { cells: CELLS },
  });

  assert.equal(solution.folder, "프로그래머스/42746. 가장 큰 수");
  assert.deepEqual(solution.files, [
    {
      path: "프로그래머스/42746. 가장 큰 수/solution.py",
      // 끝 줄바꿈이 없으면 붙입니다.
      content: "def solution(numbers):\n    return ''\n",
    },
    {
      path: "프로그래머스/42746. 가장 큰 수/README.md",
      content: [
        "# 가장 큰 수",
        "",
        "- 플랫폼: 프로그래머스",
        "- 난이도: Lv.2",
        `- 문제: ${PROGRAMMERS}`,
        "- 태그: 정렬",
        "",
      ].join("\n"),
    },
  ]);
});

test("커밋 메시지 첫 줄에 플랫폼·난이도·제목·시간·메모리를, 본문에 링크·언어·통과 수·태그를 둔다", () => {
  const { message } = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "가장 큰 수",
    language: "python3",
    code: "x",
    tags: "정렬, 문자열",
    level: "2",
    grading: { cells: CELLS },
  });

  assert.equal(
    message,
    [
      // 시간과 메모리는 칸마다 따로 가장 큰 값입니다.
      "[프로그래머스 Lv.2] 가장 큰 수 · 64.31ms · 96.4MB",
      "",
      `- 문제: ${PROGRAMMERS}`,
      "- 언어: Python3",
      "- 채점: 테스트 3개 통과",
      "- 태그: 정렬, 문자열",
    ].join("\n"),
  );
});

test("채점 표가 없는 문제는 수치를 지어내지 않는다", () => {
  const { message } = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "조회수가 가장 많은 중고거래 게시판의 첨부파일 조회하기",
    language: "mysql",
    code: "SELECT 1",
    tags: "",
    level: "3",
    grading: { cells: [] },
  });

  assert.equal(
    message,
    [
      "[프로그래머스 Lv.3] 조회수가 가장 많은 중고거래 게시판의 첨부파일 조회하기",
      "",
      `- 문제: ${PROGRAMMERS}`,
      "- 언어: MySQL",
    ].join("\n"),
  );
});

test("NeetCode는 슬러그 폴더에 두고 통과한 테스트 수를 첫 줄에 적는다", () => {
  const solution = solutionFiles({
    problemUrl: NEETCODE,
    title: "Contains Duplicate",
    language: "python",
    code: "class Solution:\n    pass\n",
    tags: "",
    grading: { passed: 34, total: 34 },
  });

  assert.equal(solution.folder, "NeetCode/duplicate-integer");
  assert.deepEqual(
    solution.files.map((file) => file.path),
    ["NeetCode/duplicate-integer/solution.py", "NeetCode/duplicate-integer/README.md"],
  );
  assert.equal(
    solution.message,
    [
      "[NeetCode] Contains Duplicate · 34/34 통과",
      "",
      `- 문제: ${NEETCODE}`,
      "- 언어: Python",
      "- 채점: 테스트 34개 통과",
    ].join("\n"),
  );
  // 난이도와 태그가 없으면 줄도 없습니다.
  assert.doesNotMatch(solution.files[1].content, /난이도|태그/);
});

test("옛 가로채기처럼 언어도 채점도 없으면 그 줄을 빼고 확장자는 txt로 둔다", () => {
  const solution = solutionFiles({
    problemUrl: NEETCODE,
    title: "Contains Duplicate",
    code: "x",
  });

  assert.equal(
    solution.message,
    `[NeetCode] Contains Duplicate\n\n- 문제: ${NEETCODE}`,
  );
  assert.equal(solution.files[0].path, "NeetCode/duplicate-integer/solution.txt");
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

test("난이도는 숫자일 때만 적는다", () => {
  const subject = (level) =>
    solutionFiles({ problemUrl: PROGRAMMERS, title: "t", code: "x", level }).message.split("\n")[0];

  assert.equal(subject("0"), "[프로그래머스 Lv.0] t");
  assert.equal(subject(""), "[프로그래머스] t");
  assert.equal(subject(undefined), "[프로그래머스] t");
  assert.equal(subject("2] 끼어들기 ["), "[프로그래머스] t");
});

test("제목에서 경로로 쓸 수 없는 글자를 걷어 낸다", () => {
  const solution = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "[PCCP 기출문제] 1번 / 붕대 감기",
    language: "java",
    code: "class Solution {}",
    tags: "",
  });

  assert.equal(solution.folder, "프로그래머스/42746. [PCCP 기출문제] 1번 붕대 감기");
  // README 제목과 커밋 메시지는 원래 제목을 그대로 씁니다.
  assert.match(solution.message, /^\[프로그래머스\] \[PCCP 기출문제\] 1번 \/ 붕대 감기\n/);
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

  assert.equal(solution.folder, "프로그래머스/42746");
  assert.match(solution.message, /^\[프로그래머스\] 42746\n/);
  assert.match(solution.files[1].content, /^# 42746\n/);
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

test("README에는 제목·플랫폼·난이도·링크·태그 말고는 아무것도 적지 않는다", () => {
  const readme = solutionFiles({
    problemUrl: PROGRAMMERS,
    title: "가장 큰 수",
    language: "python3",
    code: "x",
    tags: "정렬",
    level: "2",
    grading: { cells: CELLS },
  }).files[1].content;

  const lines = readme.split("\n").filter(Boolean);
  assert.deepEqual(
    lines.map((line) => line.split(":")[0]),
    ["# 가장 큰 수", "- 플랫폼", "- 난이도", "- 문제", "- 태그"],
  );
});

test("채점 요약은 칸마다 따로 가장 큰 시간과 메모리를 고르고 적힌 자릿수를 그대로 쓴다", () => {
  assert.deepEqual(gradingSummary({ cells: CELLS }), {
    passed: 3,
    total: null,
    time: "64.31ms",
    memory: "96.4MB",
  });
  // 수치가 없는 칸이 섞여도 통과 수는 셉니다.
  assert.deepEqual(gradingSummary({ cells: ["통과", "통과 (1.5ms, 3.0MB)"] }), {
    passed: 2,
    total: null,
    time: "1.5ms",
    memory: "3.0MB",
  });
  assert.deepEqual(gradingSummary({ passed: 34, total: 34 }), {
    passed: 34,
    total: 34,
    time: null,
    memory: null,
  });
  for (const nothing of [undefined, null, {}, { cells: [] }, { passed: 0, total: 3 }])
    assert.equal(gradingSummary(nothing), null, JSON.stringify(nothing));
});
