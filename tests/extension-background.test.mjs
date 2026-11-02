import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8")
  .replace(/^import[\s\S]*?;\n/gm, "");
const flush = () => new Promise((resolve) => setImmediate(resolve));

function worker() {
  let listener;
  const started = [];
  const finishes = [];
  const context = createContext({
    chrome: { runtime: {
      onInstalled: { addListener: () => {} },
      onMessage: { addListener: (callback) => { listener = callback; } },
    } },
    injectIntoOpenTabs: async () => {},
    uploadSolution: (input) => {
      started.push(input.code);
      return new Promise((resolve, reject) => finishes.push({ resolve, reject }));
    },
    signOut: async () => {},
    chooseRepoByName: async () => {},
    connectGithub: async () => {},
    disconnectGithub: async () => {},
    createAndChooseRepo: async () => {},
    githubState: async () => ({}),
    repoNames: async () => ({}),
    readable: (error) => error.message,
  });
  runInContext(source, context);
  return { started, finishes, send: (message, reply = () => {}) => listener(message, {}, reply) };
}

test("동시에 받은 풀이를 순서대로 올리고 한 건이 실패해도 다음 건을 처리한다", async () => {
  const background = worker();
  const replies = [];
  background.send({ type: "push-code", code: "first" }, (result) => replies.push(result));
  background.send({ type: "push-code", code: "second" }, (result) => replies.push(result));
  await flush();
  assert.deepEqual(background.started, ["first"]);
  background.finishes[0].reject(new Error("연결 실패"));
  await flush();
  assert.deepEqual(background.started, ["first", "second"]);
  background.finishes[1].resolve({ repo: "user/algo" });
  await flush();
  assert.equal(replies[0].error, "연결 실패");
  assert.equal(replies[1].repo, "user/algo");
});

test("옛 도장 기록 메시지는 더 이상 처리하지 않는다", () => {
  const background = worker();
  assert.equal(background.send({ type: "submit-code", solutionCode: "x" }), false);
  assert.deepEqual(background.started, []);
});
