import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { injectIntoOpenTabs } from "../extension/inject.js";

/**
 * 설치하거나 새 버전으로 바꿀 때 이미 열린 문제 탭에 감지 스크립트를 넣는지 봅니다.
 *
 * 크롬은 manifest의 content_scripts를 설치 뒤에 불러온 페이지에만 넣습니다. 문제를 열어
 * 둔 채 확장을 설치했더니 그 탭에서는 정답을 맞혀도 카드가 뜨지 않았습니다(2026-09-23).
 */
const MANIFEST = JSON.parse(
  readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8"),
);

const TABS = [
  {
    id: 1,
    url: "https://school.programmers.co.kr/learn/courses/30/lessons/42578?language=kotlin",
  },
  { id: 2, url: "https://neetcode.io/problems/duplicate-integer/question" },
  { id: 3, url: "https://www.acmicpc.net/problem/1000" },
];

/** manifest의 match pattern을 정규식으로 봅니다. 여기 쓰는 패턴은 *만 와일드카드입니다. */
function matches(pattern, url) {
  const source = pattern
    .split("*")
    .map((part) => part.replace(/[.?+^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}$`).test(url);
}

/** 크롬 API를 흉내 내고, 무엇을 어느 탭에 넣었는지 적어 둡니다. */
function fakeChrome({ failingTab } = {}) {
  const injected = [];
  globalThis.chrome = {
    runtime: { getManifest: () => MANIFEST },
    tabs: {
      query: async ({ url }) =>
        TABS.filter((tab) => url.some((pattern) => matches(pattern, tab.url))),
    },
    scripting: {
      insertCSS: async ({ target, files }) => {
        injected.push({ tabId: target.tabId, css: files });
      },
      executeScript: async ({ target, files, world }) => {
        if (target.tabId === failingTab) throw new Error("Frame with ID 0 was removed.");
        injected.push({ tabId: target.tabId, js: files, world });
      },
    },
  };
  return injected;
}

/** 탭마다 무엇이 어떤 순서로 들어갔는지 줄여 봅니다. 스크립트는 마지막 파일과 세계만 적습니다. */
function summary(injected) {
  const byTab = {};
  for (const call of injected) {
    const label = call.css ? call.css.join() : `${call.js.at(-1)}@${call.world}`;
    (byTab[call.tabId] ??= []).push(label);
  }
  return byTab;
}

test("설치하거나 바꾸면 열려 있던 문제 탭에 manifest의 스크립트를 넣는다", async () => {
  for (const reason of ["install", "update"]) {
    const injected = fakeChrome();
    await injectIntoOpenTabs({ reason });

    assert.deepEqual(
      summary(injected),
      {
        1: ["content/overlay.css", "content/programmers.js@ISOLATED"],
        // NeetCode 요청을 엿보는 파일은 페이지 쪽 세계에 들어가야 합니다.
        2: [
          "content/neetcode-intercept.js@MAIN",
          "content/overlay.css",
          "content/neetcode.js@ISOLATED",
        ],
      },
      reason,
    );
  }
});

test("크롬이 업데이트될 때는 넣지 않는다", async () => {
  const injected = fakeChrome();
  await injectIntoOpenTabs({ reason: "chrome_update" });
  assert.deepEqual(injected, []);
});

test("넣지 못하는 탭이 있어도 나머지 탭에는 넣는다", async () => {
  const injected = fakeChrome({ failingTab: 1 });
  await injectIntoOpenTabs({ reason: "install" });
  assert.equal(summary(injected)[2]?.length, 3);
});
