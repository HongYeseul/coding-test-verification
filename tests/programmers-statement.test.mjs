import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

/**
 * 프로그래머스 감지 스크립트가 정답 카드에 문제 분류와 설명을 어떻게 넘기는지 봅니다.
 *
 * 지키려는 것은 셋입니다. 분류가 '코딩테스트 연습'이 아니면 설명 영역을 아예 읽지 않는다 —
 * 기업 과제관·선발관 문제는 어떤 경우에도 게시할 수 없습니다. 같은 제출을 1초마다 다시 봐도
 * 화면을 한 번만 읽는다. 설명을 읽다 실패해도 카드는 뜬다 — 도장 찍기가 막히면 안 됩니다.
 * 가짜 DOM으로 실제 파일 두 개(statement.js, programmers.js)를 돌립니다.
 */
const read = (path) =>
  readFileSync(new URL(`../extension/content/${path}`, import.meta.url), "utf8");
const STATEMENT_SOURCE = read("statement.js");
const PROGRAMMERS_SOURCE = read("programmers.js");

const AREA_SELECTOR = "div.guide-section-description > div.markdown";
const CODE = "def solution():\n    return 1";

const text = (value) => ({ nodeType: 3, textContent: value });
const element = (name, ...kids) => ({
  nodeType: 1,
  nodeName: name.toUpperCase(),
  childNodes: kids,
  getAttribute: () => null,
});

/** 분류와 설명 영역을 갖춘 프로그래머스 문제 화면을 흉내 내 감지 스크립트를 한 번 돌립니다. */
function run({ catalog = "코딩테스트 연습", breakTree = false } = {}) {
  const queried = [];
  const cards = [];
  let ticks = [];
  let treeCalls = 0;

  const modal = {
    classList: { contains: (name) => name === "show" },
    querySelector: () => ({ textContent: "정답입니다!" }),
  };
  const area = element("div", element("p", text("지어낸 본문")));
  const pick = {
    "textarea#code, textarea[name='code']": { value: CODE },
    ".lesson-content": { dataset: { challengeLevel: "1" } },
    ".algorithm-title, .challenge-title": { textContent: " 실패율 " },
    "ol.breadcrumb li": { textContent: catalog },
    [AREA_SELECTOR]: area,
  };

  const window = {
    location: {
      hostname: "school.programmers.co.kr",
      pathname: "/learn/courses/30/lessons/42889",
      search: "",
      href: "https://school.programmers.co.kr/learn/courses/30/lessons/42889",
    },
    dojangConnected: () => true,
    dojangCardShowingResult: () => false,
    dojangCardRemove: () => {},
    dojangCard: (args) => cards.push(args),
  };
  const document = {
    querySelector(selector) {
      queried.push(selector);
      return pick[selector] ?? null;
    },
    querySelectorAll(selector) {
      return selector === "#modal-dialog, .modal" ? [modal] : [];
    },
  };
  const context = createContext({
    window,
    document,
    URL,
    URLSearchParams,
    getComputedStyle: () => ({ display: "block" }),
    setInterval: (callback) => ticks.push(callback),
    clearInterval: () => {},
  });

  runInContext(STATEMENT_SOURCE, context);
  const real = window.dojangStatementTree;
  window.dojangStatementTree = (root) => {
    treeCalls += 1;
    if (breakTree) throw new Error("화면 구조가 달라졌습니다.");
    return real(root);
  };
  runInContext(PROGRAMMERS_SOURCE, context);

  return {
    queried,
    cards,
    get treeCalls() {
      return treeCalls;
    },
    tick: () => ticks.forEach((callback) => callback()),
  };
}

test("연습 문제면 카드에 분류와 설명 트리를 넘긴다", () => {
  const page = run();
  page.tick();

  assert.equal(page.cards.length, 1);
  const [card] = page.cards;
  assert.equal(card.catalog, "코딩테스트 연습");
  assert.deepEqual(JSON.parse(JSON.stringify(card.statement)), {
    tag: "div",
    kids: [{ tag: "p", kids: ["지어낸 본문"] }],
  });
  // 설명을 더해도 기존에 넘기던 것은 그대로입니다.
  assert.equal(card.title, "실패율");
  assert.equal(card.code, CODE);
  assert.equal(card.level, "1");
});

test("분류가 코딩테스트 연습이 아니면 설명 영역을 읽지 않는다", () => {
  for (const catalog of ["기업 과제관", "탑프로그래머스", ""]) {
    const page = run({ catalog });
    page.tick();

    assert.equal(page.cards.length, 1, catalog);
    assert.equal(page.cards[0].statement, null, catalog);
    assert.equal(page.cards[0].catalog, catalog, catalog);
    assert.ok(!page.queried.includes(AREA_SELECTOR), `${catalog}: 설명 영역을 찾아봤습니다.`);
    assert.equal(page.treeCalls, 0, catalog);
  }
});

test("같은 제출을 다시 봐도 화면은 한 번만 읽는다", () => {
  const page = run();
  page.tick();
  page.tick();
  page.tick();

  // 카드를 누르기 전까지 1초마다 같은 제출을 봅니다. 그때마다 설명을 다시 뜨지 않습니다.
  assert.equal(page.treeCalls, 1);
  assert.equal(page.queried.filter((selector) => selector === AREA_SELECTOR).length, 1);
  assert.equal(page.cards.length, 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.cards[2].statement)),
    JSON.parse(JSON.stringify(page.cards[0].statement)),
  );
});

test("설명을 읽다 실패해도 카드는 뜬다", () => {
  const page = run({ breakTree: true });
  page.tick();
  page.tick();

  assert.equal(page.cards.length, 2);
  assert.equal(page.cards[0].statement, null);
  assert.equal(page.cards[0].title, "실패율");
  assert.equal(page.cards[0].code, CODE);
  // 실패도 담아 두어 1초마다 같은 실패를 되풀이하지 않습니다.
  assert.equal(page.treeCalls, 1);
});
