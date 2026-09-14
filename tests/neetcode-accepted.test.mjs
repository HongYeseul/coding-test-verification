import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

/**
 * NeetCode 제출을 가로채는 부분을 실제로 주고받은 값으로 검사합니다.
 *
 * 아래 요청·응답은 2026-09-14에 problems/duplicate-integer에서 실제로 오간 것을
 * 그대로 옮긴 것입니다. NeetCode가 주소나 필드 이름을 바꾸면 이 테스트가 먼저 깨져서,
 * 사용자가 '카드가 안 뜬다'로 알게 되기 전에 알 수 있습니다.
 */
const SOURCE = readFileSync(
  new URL("../extension/content/neetcode-intercept.js", import.meta.url),
  "utf8",
);

const SUBMIT_URL = "/api/executeCodeFunctionHttp";
const RUN_URL = "/api/runCodeFunctionHttp";
const CODE =
  "class Solution:\n    def hasDuplicate(self, nums: List[int]) -> bool:\n        return len(set(nums)) != len(nums)";

function submitBody() {
  return JSON.stringify({
    data: { problemId: "duplicate-integer", rawCode: CODE, lang: "python" },
  });
}

/** 실제로 받아본 오답 응답의 모양입니다. 정답은 description만 다릅니다. */
function judged(description) {
  return {
    data: {
      token: "586e00d7-533f-4067-9a5d-ddb8b3c245df",
      status: { id: 11, description },
      test_case_count: 34,
      correct_test_case_count: description === "Accepted" ? 34 : 0,
      submissionIndex: 0,
    },
  };
}

/** 확장이 끼어들기 전의 페이지를 흉내 냅니다. */
function pageWith(responseBody) {
  const events = [];
  const originalCalls = [];
  const response = {
    clone: () => ({ json: async () => responseBody }),
  };
  // 브라우저에서는 window가 곧 전역이라 가짜 페이지도 그렇게 만듭니다.
  const context = createContext({
    fetch: async (...args) => {
      originalCalls.push(args);
      return response;
    },
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    dispatchEvent: (event) => events.push(event),
  });
  context.window = context;
  runInContext(SOURCE, context);
  return { window: context, events, originalCalls, response };
}

/** 이벤트는 응답을 읽은 뒤에 나가므로 마이크로태스크를 한 번 비워줍니다. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("정답으로 제출하면 코드와 문제를 실어 알린다", async () => {
  const page = pageWith(judged("Accepted"));
  await page.window.fetch(SUBMIT_URL, { method: "POST", body: submitBody() });
  await settle();

  assert.equal(page.events.length, 1);
  assert.equal(page.events[0].type, "dojang:neetcode-accepted");
  // 이벤트는 페이지 쪽 세계에서 만들어져 프로토타입이 달라, 값만 하나씩 봅니다.
  assert.equal(page.events[0].detail.problemId, "duplicate-integer");
  assert.equal(page.events[0].detail.code, CODE);
});

test("정답이 아니면 알리지 않는다", async () => {
  for (const description of [
    "Wrong Answer",
    "Runtime Error (NZEC)",
    "Time Limit Exceeded",
  ]) {
    const page = pageWith(judged(description));
    await page.window.fetch(SUBMIT_URL, { method: "POST", body: submitBody() });
    await settle();
    assert.equal(page.events.length, 0, description);
  }
});

test("실행(Run)은 주소가 달라 정답으로 세지 않는다", async () => {
  const page = pageWith(judged("Accepted"));
  await page.window.fetch(RUN_URL, {
    method: "POST",
    body: JSON.stringify({
      data: {
        problemId: "duplicate-integer",
        rawCode: CODE,
        lang: "python",
        testCases: ["nums=[1,2,3,3]"],
      },
    }),
  });
  await settle();
  assert.equal(page.events.length, 0);
});

test("페이지의 응답은 그대로 흘려보낸다", async () => {
  const page = pageWith(judged("Accepted"));
  const returned = await page.window.fetch(SUBMIT_URL, {
    method: "POST",
    body: submitBody(),
  });
  await settle();
  // 사본을 읽으므로 페이지가 받는 응답 객체는 바뀌지 않아야 합니다.
  assert.equal(returned, page.response);
  assert.equal(page.originalCalls.length, 1);
});

test("본문이 깨져 있어도 페이지를 막지 않는다", async () => {
  for (const body of ["", "{", JSON.stringify({ data: {} }), undefined]) {
    const page = pageWith(judged("Accepted"));
    const returned = await page.window.fetch(SUBMIT_URL, {
      method: "POST",
      body,
    });
    await settle();
    assert.equal(returned, page.response, String(body));
    assert.equal(page.events.length, 0, String(body));
  }
});
