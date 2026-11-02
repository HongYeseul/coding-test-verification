import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("../extension/content/leetcode.js", import.meta.url), "utf8");
const treeSource = readFileSync(new URL("../extension/content/statement.js", import.meta.url), "utf8");
const text = (value) => ({ nodeType: 3, textContent: value });
const element = (tag, ...kids) => ({
  nodeType: 1, nodeName: tag.toUpperCase(), childNodes: kids, getAttribute: () => null,
});

function page({ missingTitle = false, missingBody = false, brokenBody = false } = {}) {
  let accepted;
  const cards = [];
  const queried = [];
  const area = element("div", element("p", text("지어낸 문제 본문")), element("pre", text("Input: 3\nOutput: 6")));
  const panel = {
    querySelector(selector) {
      queried.push(selector);
      if (selector === '[class*="text-difficulty-"]') return { textContent: "Easy" };
      if (selector === '[data-track-load="description_content"]') return missingBody ? null : area;
      throw new Error(`허용하지 않은 영역: ${selector}`);
    },
  };
  const link = { textContent: "1. Two Sum", closest: () => panel };
  const window = {
    dojangConnected: () => true,
    addEventListener: (name, listener) => { if (name === "dojang:leetcode-accepted") accepted = listener; },
    dojangCard: (input) => cards.push(input),
    location: { href: "https://leetcode.com/problems/two-sum/description/" },
  };
  const context = createContext({
    window,
    document: { title: "Two Sum - LeetCode", querySelector: () => missingTitle ? null : link },
    CSS: { escape: (value) => value },
    URL,
  });
  runInContext(treeSource, context);
  if (brokenBody) window.dojangStatementTree = () => { throw new Error("구조 변경"); };
  runInContext(source, context);
  return {
    cards, queried,
    accept: (slug = "two-sum") => accepted({ detail: { slug, code: "int x;", language: "cpp", grading: { passed: 3, total: 3 } } }),
  };
}

test("정답 제출이면 해당 문제 패널의 본문만 카드에 넘긴다", () => {
  const tab = page();
  tab.accept();
  assert.equal(tab.cards.length, 1);
  const result = JSON.parse(JSON.stringify(tab.cards[0]));
  assert.equal(result.problemUrl, "https://leetcode.com/problems/two-sum");
  assert.equal(result.title, "1. Two Sum");
  assert.equal(result.code, "int x;");
  assert.deepEqual(result.statement, {
    tag: "div", kids: [
      { tag: "p", kids: ["지어낸 문제 본문"] },
      { tag: "pre", kids: ["Input: 3\nOutput: 6"] },
    ],
  });
  assert.deepEqual(tab.queried, ['[class*="text-difficulty-"]', '[data-track-load="description_content"]']);
});

test("본문이 없거나 읽기에 실패해도 정답 코드와 제목은 남긴다", () => {
  for (const options of [{ missingTitle: true }, { missingBody: true }, { brokenBody: true }]) {
    const tab = page(options);
    tab.accept();
    assert.equal(tab.cards.length, 1);
    assert.equal(tab.cards[0].statement, null);
    assert.equal(tab.cards[0].code, "int x;");
  }
});

test("LeetCode 감지 스크립트는 본문 추출기 뒤에 실행된다", () => {
  const manifest = JSON.parse(readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"));
  const scripts = manifest.content_scripts.find((entry) => entry.js.includes("content/leetcode.js")).js;
  assert.ok(scripts.indexOf("content/statement.js") < scripts.indexOf("content/leetcode.js"));
});
