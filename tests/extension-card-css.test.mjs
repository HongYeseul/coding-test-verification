import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * 카드 안 단추의 모양이 남의 페이지 CSS에 지지 않는지 봅니다.
 *
 * 크롬은 확장이 넣은 CSS를 페이지 스타일보다 앞에 둡니다. 그래서 특이도가 같으면 페이지가
 * 이깁니다. 0.2.11에서 LeetCode의 `[type="button"], button { background-color: initial }`이
 * `.dojang-stamp`와 특이도가 같아 도장 찍기의 파란 바탕을 지웠고, 흰 글자만 흰 카드 위에 남아
 * 단추가 사라진 것처럼 보였습니다. 카드가 만드는 단추의 규칙은 모두 `.dojang-card`로 시작해
 * 한 단계 높아야 합니다.
 */
const CARD = readFileSync(
  new URL("../extension/content/card.js", import.meta.url),
  "utf8",
);
const CSS = readFileSync(
  new URL("../extension/content/overlay.css", import.meta.url),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** card.js가 단추에 붙이는 클래스입니다. `el("button", …)`과 저장소 줄의 `button(…)`을 모두 봅니다. */
function buttonClasses() {
  const found = new Set();
  for (const match of CARD.matchAll(/(?:el\("button",\s*|button\()"(dojang-[a-z-]+)"/g))
    found.add(match[1]);
  return [...found].sort();
}

/** 규칙마다 선택자를 쉼표로 나눠 돌려줍니다. @media 안쪽 규칙도 함께 나옵니다. */
function selectors() {
  return [...CSS.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((match) =>
    match[1].split(",").map((selector) => selector.trim()),
  );
}

test("카드가 만드는 단추는 모두 .dojang-card 아래에서 모양을 정한다", () => {
  const classes = buttonClasses();
  // 닫기, 도장 찍기, 저장소 줄의 작은 단추와 글자 단추, 다시 올리기·저장소 만들기입니다.
  assert.deepEqual(classes, [
    "dojang-close",
    "dojang-secondary",
    "dojang-small",
    "dojang-stamp",
    "dojang-text",
  ]);
  for (const name of classes) {
    const rules = selectors().filter((selector) =>
      new RegExp(`\\.${name}(?![a-z-])`).test(selector),
    );
    assert.ok(rules.length > 0, `${name} 규칙이 없습니다`);
    for (const rule of rules) assert.match(rule, /^\.dojang-card\s/, rule);
  }
});

test("카드 본문 칸은 긴 제목에 맞춰 늘어나지 않는다", () => {
  // 그냥 두면 격자 칸이 가장 긴 줄의 글자 폭만큼 늘어나, 긴 제목이 말줄임표 없이 카드 밖으로
  // 밀려 잘렸습니다(0.2.12, `104. Maximum Depth of Binary Tree`).
  const body = CSS.match(/\.dojang-body\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(body, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
