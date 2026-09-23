import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

/**
 * NeetCode 제출을 가로채는 부분을 실제로 주고받은 값으로 검사합니다.
 *
 * 아래 요청·응답은 2026-09-14에 problems/duplicate-integer에서 실제로 오간 것입니다.
 * NeetCode는 Angular HttpClient를 써서 제출이 **XMLHttpRequest로** 나갑니다.
 * 처음에는 fetch만 가로채서 카드가 뜨지 않았고, 그때 이 테스트는 fetch만 검사해
 * 잘못된 가정을 그대로 통과시켰습니다. 그래서 XHR을 먼저 검사합니다.
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

/** 실제로 받아본 응답의 모양입니다. 정답은 description만 다릅니다. */
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

/**
 * 확장이 끼어들기 전의 페이지를 흉내 냅니다.
 * 브라우저에서는 window가 곧 전역이라 가짜 페이지도 그렇게 만듭니다.
 */
function pageWith(responseBody) {
  const events = [];
  const fetchCalls = [];
  const response = { clone: () => ({ json: async () => responseBody }) };

  class FakeXHR {
    constructor() {
      this.listeners = {};
      // NeetCode가 실제로 쓰는 값입니다.
      this.responseType = "text";
      this.responseText = JSON.stringify(responseBody);
    }
    open() {}
    send() {}
    addEventListener(type, handler) {
      (this.listeners[type] ??= []).push(handler);
    }
    /** 서버가 답한 것처럼 만듭니다. */
    finish() {
      for (const handler of this.listeners.load ?? []) handler();
    }
  }

  const context = createContext({
    fetch: async (...args) => {
      fetchCalls.push(args);
      return response;
    },
    XMLHttpRequest: FakeXHR,
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
  return { window: context, events, fetchCalls, response, FakeXHR };
}

/** 제출 한 번을 XHR로 흉내 냅니다. */
function submitViaXhr(page, { url = SUBMIT_URL, body = submitBody() } = {}) {
  const request = new page.FakeXHR();
  request.open("POST", url);
  request.send(body);
  request.finish();
  return request;
}

/** fetch 쪽은 응답을 읽은 뒤에 알리므로 마이크로태스크를 한 번 비워줍니다. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("XHR로 정답을 제출하면 코드와 문제를 실어 알린다", () => {
  const page = pageWith(judged("Accepted"));
  submitViaXhr(page);

  assert.equal(page.events.length, 1);
  assert.equal(page.events[0].type, "dojang:neetcode-accepted");
  // 이벤트는 페이지 쪽 세계에서 만들어져 프로토타입이 달라, 값만 하나씩 봅니다.
  assert.equal(page.events[0].detail.problemId, "duplicate-integer");
  assert.equal(page.events[0].detail.code, CODE);
});

test("이미 열린 탭에 한 번 더 들어와도 정답 한 번에 한 번만 알린다", () => {
  const page = pageWith(judged("Accepted"));
  // 설치하거나 새 버전으로 바꿀 때 background가 같은 파일을 다시 넣습니다.
  runInContext(SOURCE, page.window);
  submitViaXhr(page);

  assert.equal(page.events.length, 1);
});

test("XHR 응답을 json으로 받아도 읽는다", () => {
  const page = pageWith(judged("Accepted"));
  const request = new page.FakeXHR();
  request.responseType = "json";
  request.response = judged("Accepted");
  // responseType이 json이면 responseText를 건드리는 순간 예외가 납니다.
  Object.defineProperty(request, "responseText", {
    get() {
      throw new Error("InvalidStateError");
    },
  });
  request.open("POST", SUBMIT_URL);
  request.send(submitBody());
  request.finish();

  assert.equal(page.events.length, 1);
});

test("정답이 아니면 알리지 않는다", () => {
  for (const description of [
    "Wrong Answer",
    "Runtime Error (NZEC)",
    "Time Limit Exceeded",
  ]) {
    const page = pageWith(judged(description));
    submitViaXhr(page);
    assert.equal(page.events.length, 0, description);
  }
});

test("실행(Run)은 주소가 달라 정답으로 세지 않는다", () => {
  const page = pageWith(judged("Accepted"));
  submitViaXhr(page, { url: RUN_URL });
  assert.equal(page.events.length, 0);
});

test("본문이 깨져 있어도 페이지를 막지 않는다", () => {
  for (const body of ["", "{", JSON.stringify({ data: {} })]) {
    const page = pageWith(judged("Accepted"));
    assert.doesNotThrow(() => submitViaXhr(page, { body }), String(body));
    assert.equal(page.events.length, 0, String(body));
  }
});

test("fetch로 나가도 알린다 — HttpClient가 withFetch()로 바뀔 때의 대비", async () => {
  const page = pageWith(judged("Accepted"));
  const returned = await page.window.fetch(SUBMIT_URL, {
    method: "POST",
    body: submitBody(),
  });
  await settle();

  assert.equal(page.events.length, 1);
  assert.equal(page.events[0].detail.code, CODE);
  // 사본을 읽으므로 페이지가 받는 응답 객체는 바뀌지 않아야 합니다.
  assert.equal(returned, page.response);
  assert.equal(page.fetchCalls.length, 1);
});
