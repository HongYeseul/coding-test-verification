import test from "node:test";
import assert from "node:assert/strict";

import { formatTags, parseTags } from "../src/lib/proof-input.ts";

test("쉼표로 나눠 적은 주제를 태그 목록으로 만든다", () => {
  assert.deepEqual(parseTags("해시, 정렬"), ["해시", "정렬"]);
  assert.deepEqual(parseTags("해시,,,정렬,"), ["해시", "정렬"]);
  assert.deepEqual(parseTags("  그래프  탐색 , BFS "), ["그래프 탐색", "BFS"]);
});

test("대소문자만 다른 태그는 하나로 보고 먼저 적은 것을 남긴다", () => {
  assert.deepEqual(parseTags("DP, dp, Dp"), ["DP"]);
});

test("보이지 않는 문자를 지우고 빈 값은 버린다", () => {
  assert.deepEqual(parseTags("해시\u200b, \u0007, 정렬"), ["해시", "정렬"]);
  assert.deepEqual(parseTags(""), []);
  assert.deepEqual(parseTags(null), []);
  assert.deepEqual(parseTags(undefined), []);
});

test("개수를 넘겨도 말없이 자르지 않는다", () => {
  // 자르면 사용자가 적은 태그가 조용히 사라집니다. 서버가 오류로 알려줍니다.
  assert.equal(parseTags("a,b,c,d,e,f").length, 6);
});

test("다시 적을 수 있는 모양으로 합친다", () => {
  const value = "해시, 정렬";
  assert.equal(formatTags(parseTags(value)), value);
  assert.equal(formatTags(null), "");
});
