import test from "node:test";
import assert from "node:assert/strict";

import { readable } from "../extension/errors.js";

/**
 * 확장이 사용자에게 보이는 오류 문장입니다. 크롬·Supabase·GitHub가 준 영어 원문은 그대로
 * 보이지 않아야 합니다.
 */
const FALLBACK = "GitHub 로그인을 마치지 못했습니다. 창을 닫았다면 다시 눌러주세요.";

test("네트워크가 끊기면 연결을 확인하라고 말한다", () => {
  assert.equal(
    readable(new TypeError("Failed to fetch"), FALLBACK),
    "인터넷 연결을 확인하고 다시 시도해주세요.",
  );
});

test("영어 원문은 부르는 쪽이 준 문장으로 바꾼다", () => {
  for (const error of [
    new Error("The user did not approve access."),
    new Error("Invalid login credentials"),
    new Error(""),
    "access_denied",
    undefined,
  ])
    assert.equal(readable(error, FALLBACK), FALLBACK, String(error));
});

test("우리가 지은 한국어 문장은 그대로 둔다", () => {
  const message = "이 저장소에 쓸 수 없습니다. 저장소를 다시 골라주세요.";
  assert.equal(readable(new Error(message), FALLBACK), message);
});
