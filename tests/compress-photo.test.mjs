import test from "node:test";
import assert from "node:assert/strict";
import { compressPhoto, photoDimensions } from "../src/lib/compress-photo.ts";
import { MAX_SOURCE_PHOTO_BYTES, photoError } from "../src/lib/proof-input.ts";

test("사진 비율을 유지하며 긴 변을 1920으로 줄이고 작은 사진은 확대하지 않는다", () => {
  assert.deepEqual(photoDimensions(4032, 3024), { width: 1920, height: 1440 });
  assert.deepEqual(photoDimensions(3024, 4032), { width: 1440, height: 1920 });
  assert.deepEqual(photoDimensions(640, 480), { width: 640, height: 480 });
  assert.deepEqual(photoDimensions(1, 16384), { width: 1, height: 1920 });
  for (const [w, h] of [
    [0, 1],
    [NaN, 1],
    [Infinity, 1],
    [8000, 8000],
    [1, 20000],
  ])
    assert.throws(() => photoDimensions(w, h));
});
test("압축 전 원본은 20MB, 저장 사진은 기존 6MB 제한을 사용한다", () => {
  assert.equal(
    photoError(
      { type: "image/jpeg", size: MAX_SOURCE_PHOTO_BYTES },
      MAX_SOURCE_PHOTO_BYTES,
    ),
    null,
  );
  assert.ok(
    photoError(
      { type: "image/jpeg", size: MAX_SOURCE_PHOTO_BYTES + 1 },
      MAX_SOURCE_PHOTO_BYTES,
    ),
  );
  assert.ok(photoError({ type: "image/jpeg", size: MAX_SOURCE_PHOTO_BYTES }));
});

function mockBrowser(
  t,
  {
    width = 4032,
    height = 3024,
    outputs = [],
    decodeFails = false,
    noContext = false,
  } = {},
) {
  const encodes = [];
  const context = { drawImage() {}, fillRect() {} };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (noContext ? null : context),
    toBlob(callback, type, quality) {
      encodes.push({ type, quality });
      callback(outputs.shift() ?? null);
    },
  };
  t.mock.method(URL, "createObjectURL", () => "blob:test");
  const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
  const originals = { Image: globalThis.Image, document: globalThis.document };
  globalThis.Image = class {
    naturalWidth = width;
    naturalHeight = height;
    async decode() {
      if (decodeFails) throw Error("decode failed");
    }
  };
  globalThis.document = { createElement: () => canvas };
  t.after(() => {
    for (const key of ["Image", "document"]) {
      if (originals[key] === undefined) delete globalThis[key];
      else globalThis[key] = originals[key];
    }
  });
  return { canvas, encodes, revoke };
}
const photo = (size = 2 * 1024 * 1024) =>
  new File([new Uint8Array(size)], "proof.png", { type: "image/png" });
const blob = (size, type = "image/webp") =>
  new Blob([new Uint8Array(size)], { type });

test("목표 용량을 넘으면 품질을 한 번 더 조절하고 자원을 해제한다", async (t) => {
  const small = blob(400000);
  const state = mockBrowser(t, { outputs: [blob(700000), small] });
  assert.equal(await compressPhoto(photo()), small);
  assert.deepEqual(
    state.encodes.map((x) => x.quality),
    [0.82, 0.72],
  );
  assert.equal(state.revoke.mock.callCount(), 1);
  assert.equal(state.canvas.width, 0);
  assert.equal(state.canvas.height, 0);
});
test("WebP 미지원 브라우저에서는 JPEG를 사용한다", async (t) => {
  const jpeg = blob(300000, "image/jpeg");
  const state = mockBrowser(t, { outputs: [blob(600000, "image/png"), jpeg] });
  assert.equal(await compressPhoto(photo()), jpeg);
  assert.deepEqual(
    state.encodes.map((x) => x.type),
    ["image/webp", "image/jpeg"],
  );
});
test("작은 원본은 재인코딩 결과보다 작으면 그대로 사용한다", async (t) => {
  mockBrowser(t, { width: 640, height: 480, outputs: [blob(50000)] });
  const original = photo(20000);
  assert.equal(await compressPhoto(original), original);
});
test("품질 조절 결과가 더 크면 첫 압축 결과를 사용한다", async (t) => {
  const first = blob(700000);
  mockBrowser(t, { outputs: [first, blob(800000)] });
  assert.equal(await compressPhoto(photo()), first);
});
test("손상된 파일과 인코딩 실패에서도 자원을 해제한다", async (t) => {
  const state = mockBrowser(t, { decodeFails: true });
  await assert.rejects(compressPhoto(photo()), /사진을 읽을 수 없습니다/);
  assert.equal(state.revoke.mock.callCount(), 1);
});
test("인코딩 실패 시 원본을 몰래 업로드하지 않는다", async (t) => {
  mockBrowser(t);
  await assert.rejects(compressPhoto(photo()), /압축하지 못했습니다/);
});
test("압축 후 저장 한도를 넘는 사진은 거부한다", async (t) => {
  mockBrowser(t, {
    width: 1920,
    height: 1920,
    outputs: [blob(9 * 1024 * 1024), blob(9 * 1024 * 1024)],
  });
  await assert.rejects(compressPhoto(photo(8 * 1024 * 1024)), /압축 후에도/);
});
