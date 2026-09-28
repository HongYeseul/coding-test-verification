import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

/**
 * LeetCode 제출을 가로채는 부분을 실제로 주고받은 값으로 검사합니다.
 *
 * 아래 요청·응답은 2026-09-29에 problems/two-sum에서 실제로 오간 것입니다. 세 요청 모두
 * fetch로 나갔습니다. 처음에는 채점 주소를 `/submissions/detail/<번호>/check/`로 짐작했는데,
 * 실제 제출은 `/v2/check/`로 결과를 받아 카드가 뜨지 않았습니다. `/check/`는 실행(Run)만
 * 씁니다. 그래서 v2 주소를 먼저 검사합니다.
 */
const SOURCE = readFileSync(
  new URL("../extension/content/leetcode-intercept.js", import.meta.url),
  "utf8",
);

const SUBMIT_URL = "/problems/two-sum/submit/";
const SUBMISSION_ID = 2156492751;
const CHECK_URL = `/submissions/detail/${SUBMISSION_ID}/v2/check/`;
const RUN_URL = "/problems/two-sum/interpret_solution/";
const RUN_ID = "runcode_1790636380.0670998_wrHUY0p9zK";
const CODE = [
  "class Solution {",
  "public:",
  "    vector<int> twoSum(vector<int>& nums, int target) {",
  "        unordered_map<int, int> seen;",
  "        for (int i = 0; i < (int)nums.size(); ++i) {",
  "            auto it = seen.find(target - nums[i]);",
  "            if (it != seen.end()) return {it->second, i};",
  "            seen[nums[i]] = i;",
  "        }",
  "        return {};",
  "    }",
  "};",
].join("\n");

function submitBody() {
  return JSON.stringify({ lang: "cpp", question_id: "1", typed_code: CODE });
}

/**
 * 실제로 받아 본 마지막 채점 응답입니다. 오답은 받아 보지 못해, 같은 모양에서 판정과
 * 틀린 테스트 칸만 바꿔 흉내 냅니다.
 */
function judged(overrides = {}) {
  return {
    status_code: 10,
    lang: "cpp",
    run_success: true,
    status_runtime: "4 ms",
    memory: 14876000,
    display_runtime: "4",
    question_id: "1",
    elapsed_time: 20,
    compare_result: "1".repeat(65),
    code_output: "",
    std_output: "",
    last_testcase: "",
    expected_output: "",
    task_finish_time: 1790636405288,
    task_name: "judger.judgetask.Judge",
    finished: true,
    total_correct: 65,
    total_testcases: 65,
    runtime_percentile: 53.548,
    status_memory: "14.9 MB",
    memory_percentile: 44.88049999999997,
    pretty_lang: "C++",
    submission_id: String(SUBMISSION_ID),
    status_msg: "Accepted",
    state: "SUCCESS",
    judger_status_code: 10,
    ...overrides,
  };
}

/** 실행(Run)의 마지막 응답입니다. 정답과 똑같이 SUCCESS·Accepted로 옵니다. */
const RUN_RESULT = {
  status_code: 10,
  lang: "cpp",
  run_success: true,
  status_runtime: "0 ms",
  task_name: "judger.runcodetask.RunCode",
  correct_answer: true,
  total_correct: 3,
  total_testcases: 3,
  status_memory: "8.5 MB",
  submission_id: RUN_ID,
  status_msg: "Accepted",
  state: "SUCCESS",
};

/**
 * 확장이 끼어들기 전의 페이지를 흉내 냅니다. 브라우저에서는 window가 곧 전역이라 가짜
 * 페이지도 그렇게 만듭니다. 서버 대신 reply로 다음 응답을 정합니다.
 */
function page() {
  const events = [];
  let next = null;
  const response = { clone: () => ({ json: async () => next }) };

  class FakeXHR {
    constructor() {
      this.listeners = {};
      this.responseType = "text";
    }
    open() {}
    send() {}
    addEventListener(type, handler) {
      (this.listeners[type] ??= []).push(handler);
    }
    /** 서버가 답한 것처럼 만듭니다. */
    finish(body) {
      this.responseText = JSON.stringify(body);
      for (const handler of this.listeners.load ?? []) handler();
    }
  }

  const context = createContext({
    URL,
    location: { href: "https://leetcode.com/problems/two-sum/description/" },
    fetch: async () => response,
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

  /** fetch로 요청 하나를 보내고 확장이 응답을 다 읽을 때까지 기다립니다. */
  async function call(url, { body, reply }) {
    next = reply;
    const options = body === undefined ? { method: "GET" } : { method: "POST", body };
    const returned = await context.fetch(url, options);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return returned;
  }

  /** 같은 요청을 XMLHttpRequest로 보냅니다. */
  function xhr(url, { body, reply }) {
    const request = new FakeXHR();
    request.open(body === undefined ? "GET" : "POST", url);
    request.send(body);
    request.finish(reply);
  }

  return { window: context, events, response, call, xhr };
}

/** 제출부터 채점이 끝날 때까지를 한 번에 흘립니다. */
async function submitAndJudge(tab, final = judged()) {
  await tab.call(SUBMIT_URL, {
    body: submitBody(),
    reply: { submission_id: SUBMISSION_ID },
  });
  await tab.call(CHECK_URL, { reply: { state: "PENDING" } });
  await tab.call(CHECK_URL, { reply: { state: "STARTED" } });
  await tab.call(CHECK_URL, { reply: final });
}

test("정답이면 제출한 코드와 채점 요약을 실어 한 번 알린다", async () => {
  const tab = page();
  await tab.call(SUBMIT_URL, {
    body: submitBody(),
    reply: { submission_id: SUBMISSION_ID },
  });
  await tab.call(CHECK_URL, { reply: { state: "PENDING" } });
  await tab.call(CHECK_URL, { reply: { state: "STARTED" } });
  // 채점 중에는 알리지 않습니다.
  assert.equal(tab.events.length, 0);

  await tab.call(CHECK_URL, { reply: judged() });
  assert.equal(tab.events.length, 1);
  const [event] = tab.events;
  assert.equal(event.type, "dojang:leetcode-accepted");
  // 이벤트는 페이지 쪽 세계에서 만들어져 프로토타입이 달라, 값만 하나씩 봅니다.
  assert.equal(event.detail.slug, "two-sum");
  assert.equal(event.detail.code, CODE);
  // 저장소에 올릴 파일 확장자를 정하는 값입니다.
  assert.equal(event.detail.language, "cpp");
  // 커밋 메시지의 `4ms · 14.9MB`와 `테스트 65개 통과`가 됩니다.
  assert.equal(event.detail.grading.passed, 65);
  assert.equal(event.detail.grading.total, 65);
  assert.equal(event.detail.grading.time, "4 ms");
  assert.equal(event.detail.grading.memory, "14.9 MB");
  // 알리는 값은 이 넷뿐입니다. 채점 응답의 다른 칸은 옮기지 않습니다.
  assert.deepEqual(Object.keys(event.detail).sort(), [
    "code",
    "grading",
    "language",
    "slug",
  ]);

  // 페이지가 한 번 더 물어도 두 번 알리지 않습니다.
  await tab.call(CHECK_URL, { reply: judged() });
  assert.equal(tab.events.length, 1);
});

test("실행(Run)은 결과가 Accepted여도 알리지 않는다", async () => {
  const tab = page();
  await tab.call(RUN_URL, {
    body: JSON.stringify({
      lang: "cpp",
      question_id: "1",
      typed_code: CODE,
      data_input: "[2,7,11,15]\n9",
    }),
    reply: { interpret_id: RUN_ID, test_case: "[2,7,11,15]\n9" },
  });
  await tab.call(`/submissions/detail/${RUN_ID}/check/`, {
    reply: { state: "PENDING" },
  });
  await tab.call(`/submissions/detail/${RUN_ID}/check/`, { reply: RUN_RESULT });

  assert.equal(tab.events.length, 0);
});

test("정답이 아니면 알리지 않는다", async () => {
  for (const [status_code, status_msg] of [
    [11, "Wrong Answer"],
    [14, "Time Limit Exceeded"],
    [15, "Runtime Error"],
    [20, "Compile Error"],
  ]) {
    const tab = page();
    await submitAndJudge(
      tab,
      judged({
        status_code,
        status_msg,
        total_correct: 10,
        last_testcase: "[3,2,4]\n6",
        expected_output: "[1,2]",
      }),
    );
    assert.equal(tab.events.length, 0, status_msg);
  }
});

test("제출하지 않은 번호의 채점 응답은 보지 않는다", async () => {
  const tab = page();
  await tab.call(CHECK_URL, { reply: judged() });
  assert.equal(tab.events.length, 0);
});

test("v2가 없는 옛 채점 주소로 와도 알린다", async () => {
  const tab = page();
  await tab.call(SUBMIT_URL, {
    body: submitBody(),
    reply: { submission_id: SUBMISSION_ID },
  });
  await tab.call(`/submissions/detail/${SUBMISSION_ID}/check/`, {
    reply: judged(),
  });
  assert.equal(tab.events.length, 1);
});

test("대회 문제의 제출은 보지 않는다", async () => {
  const tab = page();
  await tab.call("/contest/weekly-contest-400/problems/two-sum/submit/", {
    body: submitBody(),
    reply: { submission_id: SUBMISSION_ID },
  });
  await tab.call(CHECK_URL, { reply: judged() });
  assert.equal(tab.events.length, 0);
});

test("이미 열린 탭에 한 번 더 들어와도 정답 한 번에 한 번만 알린다", async () => {
  const tab = page();
  // 설치하거나 새 버전으로 바꿀 때 background가 같은 파일을 다시 넣습니다.
  runInContext(SOURCE, tab.window);
  await submitAndJudge(tab);
  assert.equal(tab.events.length, 1);
});

test("XMLHttpRequest로 바뀌어도 알린다", () => {
  const tab = page();
  tab.xhr(SUBMIT_URL, {
    body: submitBody(),
    reply: { submission_id: SUBMISSION_ID },
  });
  tab.xhr(CHECK_URL, { reply: { state: "PENDING" } });
  tab.xhr(CHECK_URL, { reply: judged() });

  assert.equal(tab.events.length, 1);
  assert.equal(tab.events[0].detail.code, CODE);
});

test("본문이 깨져 있어도 페이지를 막지 않는다", async () => {
  for (const body of ["", "{", JSON.stringify({ lang: "cpp" })]) {
    const tab = page();
    await assert.doesNotReject(async () => {
      await tab.call(SUBMIT_URL, {
        body,
        reply: { submission_id: SUBMISSION_ID },
      });
      await tab.call(CHECK_URL, { reply: judged() });
    }, String(body));
    assert.equal(tab.events.length, 0, String(body));
  }
});

test("페이지가 받는 응답은 그대로 둔다", async () => {
  const tab = page();
  // 사본을 읽으므로 페이지가 받는 응답 객체는 바뀌지 않아야 합니다.
  const returned = await tab.call(SUBMIT_URL, {
    body: submitBody(),
    reply: { submission_id: SUBMISSION_ID },
  });
  assert.equal(returned, tab.response);
});
