import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNextPath, loginPath } from "../src/lib/auth-navigation.ts";

test("로그인 복귀 주소로 외부 URL과 백슬래시를 허용하지 않는다", () => {
  for (const value of [
    null,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/\n/evil.example",
    "javascript:alert(1)",
    "/auth/callback",
    "/?next=/dashboard",
  ]) {
    assert.equal(safeNextPath(value), "/dashboard");
  }
});

test("정상 초대 경로와 쿼리는 로그인 실패 후에도 유지한다", () => {
  const invitation = "/invite/abcdefghijklmnopqrstuvwxyz123456?from=group";
  assert.equal(safeNextPath(invitation), invitation);
  const retry = new URL(
    loginPath(invitation, "exchange"),
    "https://coding-proof.invalid",
  );
  assert.equal(retry.searchParams.get("next"), invitation);
  assert.equal(retry.searchParams.get("auth_error"), "exchange");
});
