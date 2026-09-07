import test from "node:test";
import assert from "node:assert/strict";
import {
  githubHandle,
  normalizeBio,
  normalizeDisplayName,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
} from "../src/lib/profile.ts";

test("닉네임은 앞뒤 공백을 지우고 연속 공백을 한 칸으로 모은다", () => {
  assert.equal(normalizeDisplayName("  홍  예슬 "), "홍 예슬");
  assert.equal(normalizeDisplayName("예슬\t\n님"), "예슬 님");
  assert.equal(normalizeDisplayName("   "), "");
  assert.equal(normalizeDisplayName(""), "");
});

test("닉네임에서 제어문자와 사칭에 쓰이는 방향 제어문자를 지운다", () => {
  assert.equal(normalizeDisplayName("예\u0000슬"), "예슬");
  assert.equal(normalizeDisplayName("\u202egnimmargorp"), "gnimmargorp");
  assert.equal(normalizeDisplayName("\u200f예슬\u200e"), "예슬");
  assert.equal(normalizeDisplayName("\u2066예슬\u2069"), "예슬");
  // 이모지 결합에 쓰이는 ZWJ는 남깁니다.
  assert.equal(
    normalizeDisplayName("\u{1f468}\u200d\u{1f4bb}"),
    "\u{1f468}\u200d\u{1f4bb}",
  );
});

test("닉네임과 한 줄 소개는 각각 40자와 80자로 자른다", () => {
  assert.equal(MAX_DISPLAY_NAME_LENGTH, 40);
  assert.equal(MAX_BIO_LENGTH, 80);
  assert.equal(normalizeDisplayName("가".repeat(50)).length, 40);
  assert.equal(normalizeBio("나".repeat(100)).length, 80);
  assert.equal(normalizeBio("  매일 한 문제  "), "매일 한 문제");
});

test("GitHub 아이디는 형식에 맞는 값만 화면에 표시한다", () => {
  assert.equal(githubHandle("hongyeseul"), "hongyeseul");
  assert.equal(githubHandle("5bus123"), "5bus123");
  assert.equal(githubHandle("a-b-c"), "a-b-c");
  for (const login of [
    null,
    undefined,
    "",
    "-lead",
    "trail-",
    "double--hyphen",
    "HongYeseul",
    "has space",
    "a".repeat(40),
    "javascript:alert(1)",
  ]) {
    assert.equal(githubHandle(login), null);
  }
});
