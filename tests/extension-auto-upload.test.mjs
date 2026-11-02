import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const source = readFileSync(new URL("../extension/content/card.js", import.meta.url), "utf8");
const solution = { title: "지어낸 문제", problemUrl: "https://leetcode.com/problems/example", code: "print(1)", language: "python3", statement: { tag: "div", kids: ["본문"] } };

class Node {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.listeners = {};
    this.className = "";
    this.classList = {
      contains: (name) => this.className.split(" ").includes(name),
      add: (name) => { if (!this.classList.contains(name)) this.className += ` ${name}`; },
      remove: (name) => { this.className = this.className.split(" ").filter((item) => item !== name).join(" "); },
      toggle: (name, yes) => yes ? this.classList.add(name) : this.classList.remove(name),
    };
  }
  get lastChild() { return this.children.at(-1); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this); this.parentElement = null; }
  replaceWith(node) { const parent = this.parentElement; const index = parent.children.indexOf(this); this.remove(); node.remove(); parent.children.splice(index, 0, node); node.parentElement = parent; }
  setAttribute() {}
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelector(selector) { return this.walk().find((node) => selector.startsWith(".dojang-card[") ? node.classList.contains("dojang-card") : node.classList.contains(selector.slice(1))) ?? null; }
  walk() { return this.children.flatMap((node) => [node, ...node.walk()]); }
}

function page(handler = () => ({ repo: "user/algo", url: "https://github.com/user/algo" }), state = { connected: true, repo: "user/algo", url: "https://github.com/user/algo" }) {
  const calls = [];
  const body = new Node("body");
  const window = {
    dojangSeal: () => new Node("svg"),
    matchMedia: () => ({ matches: false }),
  };
  const context = createContext({
    window,
    document: { body, createElement: (tag) => new Node(tag), querySelector: (selector) => body.querySelector(selector) },
    chrome: { runtime: { id: "extension", sendMessage: async (message) => {
      calls.push(message);
      if (message.type === "github-state") return state;
      return handler(message);
    } } },
    crypto: { randomUUID: () => "world" },
    clearTimeout: () => {},
  });
  runInContext(source, context);
  return { calls, body, window, card: (input = solution) => window.dojangCard(input) };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("클릭 없이 GitHub에만 보내고 성공 후 완료를 표시한다", async () => {
  let done = 0;
  const tab = page();
  tab.card({ ...solution, onStamped: () => { done += 1; } });
  await flush();
  assert.deepEqual(tab.calls.map((message) => message.type), ["github-state", "github-state", "push-code"]);
  assert.deepEqual(JSON.parse(JSON.stringify(tab.calls[2].statement)), solution.statement);
  assert.equal(done, 1);
  assert.equal(tab.body.querySelector(".dojang-heading").textContent, "저장소에 올렸습니다");
});

test("카드를 닫고 같은 정답을 다시 감지해도 진행 중인 업로드를 중복하지 않는다", async () => {
  let finish;
  const tab = page(() => new Promise((resolve) => { finish = resolve; }));
  tab.card();
  await flush();
  tab.window.dojangCardRemove();
  tab.card();
  await flush();
  assert.equal(tab.calls.filter((message) => message.type === "push-code").length, 1);
  finish({ repo: "user/algo", url: "https://github.com/user/algo" });
  await flush();
});

test("실패하면 완료 처리하지 않고 다시 올리기로 재시도한다", async () => {
  let attempts = 0;
  let done = 0;
  const tab = page(() => ++attempts === 1 ? { error: "연결 실패" } : { repo: "user/algo", url: "https://github.com/user/algo" });
  tab.card({ ...solution, onStamped: () => { done += 1; } });
  await flush();
  assert.equal(done, 0);
  const retry = tab.body.walk().find((node) => node.textContent === "다시 올리기");
  assert.ok(retry);
  retry.listeners.click();
  await flush();
  assert.equal(done, 1);
  assert.equal(attempts, 2);
});

test("로그인 또는 저장소 선택 전에는 자동 창을 열거나 업로드하지 않는다", async () => {
  for (const state of [{ connected: false, repo: null }, { connected: true, repo: null }]) {
    const tab = page(undefined, state);
    tab.card();
    await flush();
    assert.deepEqual(tab.calls.map((message) => message.type), ["github-state"]);
    assert.ok(tab.body.walk().some((node) => node.textContent === (state.connected ? "저장소 고르기" : "GitHub로 로그인")));
  }
});

test("서로 다른 정답이 연달아 오면 두 풀이 모두 올린다", async () => {
  const finishes = [];
  const tab = page(() => new Promise((resolve) => finishes.push(resolve)));
  tab.card();
  await flush();
  tab.card({ ...solution, problemUrl: "https://leetcode.com/problems/next-example" });
  await flush();
  assert.equal(tab.calls.filter((message) => message.type === "push-code").length, 2);
  for (const finish of finishes) finish({ repo: "user/algo", url: "https://github.com/user/algo" });
  await flush();
});
