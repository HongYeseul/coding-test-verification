import test from "node:test";
import assert from "node:assert/strict";

import { problemLink } from "../src/lib/proof-input.ts";
import { problemUrlFromTab } from "../extension/capture.js";

// 확장은 웹앱 코드를 가져다 쓸 수 없어 허용 호스트 목록을 복제합니다.
// 둘이 어긋나면 확장이 보낸 링크를 서버가 거절하므로 여기서 함께 검사합니다.
const cases = [
  "https://school.programmers.co.kr/learn/courses/30/lessons/42626",
  "https://www.acmicpc.net/problem/1000/",
  "https://leetcode.com/problems/two-sum?envType=daily",
  "https://neetcode.io/problems/duplicate-integer/question?list=neetcode150",
  "https://codeforces.com/problemset/problem/4/A",
  "https://atcoder.jp/contests/abc300/tasks/abc300_a",
  "https://hackerrank.com/challenges/solve-me-first",
  "https://codewars.com/kata/valid-braces",
  "https://example.com/problem/1",
  "http://acmicpc.net/problem/1000",
  "잘못된 주소",
  "",
];

test("확장의 문제 링크 추출은 웹앱의 허용 규칙과 같은 결과를 낸다", () => {
  for (const value of cases) {
    assert.equal(
      problemUrlFromTab(value),
      problemLink(value)?.url ?? "",
      `어긋난 입력: ${value}`,
    );
  }
});

test("확장은 탭 주소가 없어도 빈 문자열을 돌려준다", () => {
  assert.equal(problemUrlFromTab(undefined), "");
  assert.equal(problemUrlFromTab(null), "");
});
