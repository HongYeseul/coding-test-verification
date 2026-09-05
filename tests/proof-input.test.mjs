import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeInviteCode,
  isPhotoPath,
  photoError,
  MAX_PHOTO_BYTES,
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
