import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInviteCode,
  isPhotoPath,
  photoError,
  problemLink,
  MAX_PHOTO_BYTES,
  MAX_PROBLEM_URL_LENGTH,
} from "../src/lib/proof-input.ts";

test("5자리 초대코드는 대문자로 정규화하고 혼동되는 문자와 잘못된 길이를 거부한다", () => {
  assert.equal(normalizeInviteCode(" ab2cd "), "AB2CD");
  for (const code of [
    "AB0CD",
    "AB1CD",
    "ABICD",
    "ABOCD",
    "ABCD",
    "ABCDEF",
    "AB/CD",
    "<img>",
  ]) {
    assert.equal(normalizeInviteCode(code), null);
  }
});
test("사진은 JPG PNG WebP만 허용하고 빈 파일과 300KB 초과를 거부한다", () => {
  assert.equal(MAX_PHOTO_BYTES, 307200);
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    assert.equal(photoError({ type, size: MAX_PHOTO_BYTES }), null);
  assert.ok(photoError({ type: "image/png", size: 0 }));
  assert.ok(photoError({ type: "image/png", size: MAX_PHOTO_BYTES + 1 }));
  assert.ok(photoError({ type: "image/svg+xml", size: 1024 }));
  assert.ok(photoError({ type: "toString", size: 1024 }));
  assert.ok(photoError({ type: "image/png", size: NaN }));
});
test("사진 경로는 지정 그룹과 작성자의 UUID 파일만 허용한다", () => {
  const name = "0cc5963d-00f0-4c33-a71b-d7c1d224e128.png";
  assert.equal(isPhotoPath(`group/user/${name}`, "group", "user"), true);
  for (const path of [
    `group/other/${name}`,
    `other/user/${name}`,
    `group/user/../${name}`,
    `group/user/${name}.svg`,
    "group/user/file.png",
  ]) {
    assert.equal(isPhotoPath(path, "group", "user"), false);
  }
});

test("문제 링크는 허용한 플랫폼의 https 주소만 통과시킨다", () => {
  assert.deepEqual(
    problemLink(" https://www.acmicpc.net/problem/1000 "),
    { url: "https://acmicpc.net/problem/1000", platform: "백준" },
  );
  assert.equal(
    problemLink("https://school.programmers.co.kr/learn/courses/30/lessons/12345")
      .platform,
    "프로그래머스",
  );
  for (const value of [
    "",
    null,
    undefined,
    "문제 링크",
    "http://acmicpc.net/problem/1000",
    "javascript:alert(1)",
    "data:text/html,<script></script>",
    "https://acmicpc.net.evil.com/problem/1000",
    "https://evil.com/https://acmicpc.net/problem/1000",
    "https://constructor/problem/1000",
    "https://toString/problem/1000",
  ]) {
    assert.equal(problemLink(value), null, String(value));
  }
});

test("문제 링크는 언어 선택과 끝 슬래시를 지워 같은 문제를 하나로 모은다", () => {
  const canonical = "https://leetcode.com/problems/two-sum";
  for (const value of [
    "https://leetcode.com/problems/two-sum",
    "https://leetcode.com/problems/two-sum/",
    "https://leetcode.com/problems/two-sum?language=python3",
    "https://leetcode.com/problems/two-sum#solution",
    "https://user:pass@leetcode.com:443/problems/two-sum",
  ]) {
    assert.equal(problemLink(value).url, canonical, value);
  }
});

test("문제 링크는 길이 상한을 넘으면 거부한다", () => {
  const path = "a".repeat(MAX_PROBLEM_URL_LENGTH);
  assert.equal(problemLink(`https://acmicpc.net/problem/${path}`), null);
});
