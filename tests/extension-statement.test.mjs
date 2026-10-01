import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { STATEMENT_LIMIT, statementMarkdown } from "../extension/statement.js";

/**
 * 문제 설명을 README에 둘 마크다운으로 바꾸는 부분을 봅니다.
 *
 * 입력은 남의 페이지에서 온 값이라, 변환기는 그 값이 README에 낯선 서식이나 HTML, 위험한
 * 주소를 끼워 넣지 못하게 막아야 합니다. 아래 글은 모두 지어낸 것입니다 — 모양만 프로그래머스
 * 문제 설명(h2·h5·p·ul·code·table·br·img)을 닮았습니다.
 */
const h = (tag, attrs, ...kids) => ({ tag, ...(attrs ? { attrs } : {}), kids });
const root = (...kids) => h("div", null, ...kids);
const convert = (...kids) => statementMarkdown(root(...kids));

test("문단·제목·목록·인라인 코드·표를 마크다운으로 옮긴다", () => {
  assert.equal(
    convert(
      h("p", null, "수 ", h("code", null, "n"), "개가 주어집니다."),
      h("h5", null, "제한사항"),
      h("ul", null, h("li", null, "첫째"), h("li", null, "둘째")),
      h("h5", null, "입출력 예"),
      h(
        "table",
        null,
        h("thead", null, h("tr", null, h("th", null, "a"), h("th", null, "b"))),
        h("tbody", null, h("tr", null, h("td", null, "1"), h("td", null, "2"))),
      ),
    ),
    [
      "수 `n`개가 주어집니다.",
      "",
      "### 제한사항",
      "",
      "- 첫째",
      "- 둘째",
      "",
      "### 입출력 예",
      "",
      "| a | b |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n"),
  );
});

test("제목과 같은 첫 제목만 뺀다", () => {
  const tree = root(h("h2", null, "예시 문제"), h("p", null, "본문"), h("h5", null, "예시 문제"));
  assert.equal(statementMarkdown(tree, { title: "예시 문제" }), "본문\n\n### 예시 문제");
  assert.equal(statementMarkdown(tree), "### 예시 문제\n\n본문\n\n### 예시 문제");
});

test("중첩 목록은 들여쓰고, 순서 목록은 번호를 매기고, 한 항목의 두 문단은 빈 줄로 띄운다", () => {
  assert.equal(
    convert(
      h(
        "ul",
        null,
        h("li", null, "위", h("ul", null, h("li", null, "아래"))),
        h("li", null, h("p", null, "한 문단"), h("p", null, "두 문단")),
      ),
      h("ol", null, h("li", null, "하나"), h("li", null, "둘")),
    ),
    ["- 위", "  - 아래", "- 한 문단", "", "  두 문단", "", "1. 하나", "2. 둘"].join("\n"),
  );
});

test("문단 안의 br은 강제 줄바꿈이 되고 표 안에서는 br 태그로 남는다", () => {
  assert.equal(
    convert(h("p", null, "앞줄", h("br"), "뒷줄", h("br"))),
    "앞줄\\\n뒷줄",
  );
  assert.equal(
    convert(
      h(
        "table",
        null,
        h("tr", null, h("th", null, "x")),
        h("tr", null, h("td", null, "가", h("br"), "나")),
      ),
    ),
    ["| x |", "| --- |", "| 가<br>나 |"].join("\n"),
  );
});

test("표 칸 수가 모자란 줄은 빈 칸으로 채우고, 칸 안의 | 는 이스케이프한다", () => {
  assert.equal(
    convert(
      h(
        "table",
        null,
        h("tr", null, h("th", null, "a"), h("th", null, "b")),
        h("tr", null, h("td", null, h("code", null, "x|y"))),
      ),
    ),
    ["| a | b |", "| --- | --- |", "| `x\\|y` |  |"].join("\n"),
  );
});

test("마크다운 기호는 글자 그대로 보이게 이스케이프한다", () => {
  assert.equal(
    convert(h("p", null, "a*b_c [d] <e> `f` | ~g~ $h$ &amp; \\")),
    "a\\*b\\_c \\[d\\] \\<e\\> \\`f\\` \\| \\~g\\~ \\$h\\$ &amp;amp; \\\\",
  );
});

test("줄 맨 앞에서 제목·목록·구분선으로 읽힐 글자도 막는다", () => {
  for (const [text, expected] of [
    ["# 제목처럼", "\\# 제목처럼"],
    ["- 목록처럼", "\\- 목록처럼"],
    ["+ 목록처럼", "\\+ 목록처럼"],
    ["1. 번호처럼", "1\\. 번호처럼"],
    ["---", "\\---"],
    ["===", "\\==="],
  ])
    assert.equal(convert(h("p", null, text)), expected, text);
  // 줄바꿈 뒤의 줄도 새 줄이라 같은 규칙을 받습니다.
  assert.equal(convert(h("p", null, "앞", h("br"), "# 뒤")), "앞\\\n\\# 뒤");
});

test("HTML 태그처럼 보이는 글은 태그가 되지 않는다", () => {
  const markdown = convert(h("p", null, '<script>alert(1)</script><img src="x" onerror="y">'));
  // 꺾쇠가 하나라도 이스케이프 없이 남아 있으면 README에서 태그로 읽힙니다.
  assert.ok(!/(^|[^\\])[<>]/.test(markdown), markdown);
  assert.equal(
    markdown,
    '\\<script\\>alert(1)\\</script\\>\\<img src="x" onerror="y"\\>',
  );
});

test("굵게·기울임·위아래 첨자는 HTML 태그로 내고 앞뒤 공백은 밖으로 뺀다", () => {
  assert.equal(
    convert(
      h(
        "p",
        null,
        "한",
        h("strong", null, "굵게 "),
        "글",
        h("em", null, "기울임"),
        "10",
        h("sup", null, "5"),
        "a",
        h("sub", null, "i"),
      ),
    ),
    "한<strong>굵게</strong> 글<em>기울임</em>10<sup>5</sup>a<sub>i</sub>",
  );
  // 빈 서식은 남기지 않습니다.
  assert.equal(convert(h("p", null, "가", h("strong", null, " "), "나")), "가 나");
});

test("링크와 이미지는 http(s) 주소만 받는다", () => {
  assert.equal(
    convert(
      h("p", null, h("a", { href: "https://example.com/a b(c)" }, "링크")),
      h("p", null, h("a", { href: "javascript:alert(1)" }, "위험")),
      h("p", null, h("a", {}, "주소 없음")),
      h("p", null, h("img", { src: "https://example.com/x.png", alt: "그림 [1]" })),
      h("p", null, h("img", { src: "data:image/png;base64,AAAA", alt: "데이터" })),
      h("p", null, h("img", { src: "/상대/경로.png" })),
    ),
    [
      "[링크](https://example.com/a%20b%28c%29)",
      "",
      "위험",
      "",
      "주소 없음",
      "",
      "![그림 \\[1\\]](https://example.com/x.png)",
    ].join("\n"),
  );
});

test("코드 블록은 안의 백틱보다 긴 울타리로 감싸고 들여쓰기를 지킨다", () => {
  assert.equal(
    convert(h("pre", null, h("code", null, "def f():\n    return '```'\n"))),
    "````\ndef f():\n    return '```'\n````",
  );
  // 줄 안의 코드도 백틱을 품으면 더 긴 백틱으로 감쌉니다.
  assert.equal(convert(h("p", null, h("code", null, "a`b"))), "``a`b``");
});

test("인용과 구분선도 옮긴다", () => {
  assert.equal(
    convert(h("blockquote", null, h("p", null, "첫째"), h("p", null, "둘째")), h("hr")),
    "> 첫째\n>\n> 둘째\n\n---",
  );
});

test("모르는 태그는 풀어서 안의 글만 잇고 글 사이 공백은 하나로 모은다", () => {
  assert.equal(
    convert(h("div", null, h("span", null, "가\n\n   나"), " ", h("font", null, "다"))),
    "가 나 다",
  );
});

test("비었거나 모양이 틀린 입력은 빈 문자열이다", () => {
  for (const tree of [null, undefined, "문자열", 3, {}, { tag: "div" }, root(), root(h("p", null, "  "))])
    assert.equal(statementMarkdown(tree), "", JSON.stringify(tree));
});

test("한도를 넘는 설명은 자르지 않고 통째로 뺀다", () => {
  assert.equal(convert(h("p", null, "가".repeat(STATEMENT_LIMIT))).length, STATEMENT_LIMIT);
  assert.equal(convert(h("p", null, "가".repeat(STATEMENT_LIMIT + 1))), "");
});

test("너무 깊은 트리는 예외 없이 빈 문자열이다", () => {
  let deep = h("p", null, "끝");
  for (let i = 0; i < 100; i += 1) deep = h("div", null, deep);
  assert.equal(statementMarkdown(deep), "");
});

/**
 * 화면에서 트리를 뜨는 content/statement.js입니다. 크롬 없이 node:vm에서 가짜 DOM으로 돌립니다.
 */
const SOURCE = readFileSync(
  new URL("../extension/content/statement.js", import.meta.url),
  "utf8",
);

const text = (value) => ({ nodeType: 3, textContent: value });
const node = (name, attributes = {}, ...kids) => ({
  nodeType: 1,
  nodeName: name.toUpperCase(),
  childNodes: kids,
  getAttribute: (key) => attributes[key] ?? null,
});

function dump(root) {
  const window = {
    location: { href: "https://school.programmers.co.kr/learn/courses/30/lessons/42889" },
  };
  runInContext(SOURCE, createContext({ window, URL }));
  // vm 안에서 만든 객체는 프로토타입이 달라 deepEqual이 구조가 같아도 실패합니다. 실제로도
  // 메시지로 넘어가며 JSON처럼 복사되므로 그렇게 한 번 돌려 받습니다.
  return JSON.parse(JSON.stringify(window.dojangStatementTree(root)));
}

test("화면에서 뜬 트리는 허용한 태그와 주소 속성만 남긴다", () => {
  const tree = dump(
    node(
      "div",
      { class: "markdown", onclick: "steal()" },
      node("script", {}, text("steal()")),
      node("style", {}, text("p{}")),
      node("input", { value: "비밀" }),
      node("p", { style: "color:red" }, text("글"), node("font", {}, text("풀림"))),
      node("a", { href: "/relative/path", target: "_blank" }, text("상대")),
      node("a", { href: "javascript:alert(1)" }, text("위험")),
      node("img", { src: "https://example.com/x.png", alt: "그림", onerror: "x()" }),
      node("img", { src: "data:image/png;base64,AAAA" }),
      { nodeType: 8, textContent: "주석" },
    ),
  );

  // 루트 요소 자체는 담지 않고 그 안의 내용만 새 div 아래에 둡니다.
  assert.deepEqual(tree, {
    tag: "div",
    kids: [
      { tag: "p", kids: ["글", "풀림"] },
      {
        tag: "a",
        attrs: { href: "https://school.programmers.co.kr/relative/path" },
        kids: ["상대"],
      },
      { tag: "a", kids: ["위험"] },
      { tag: "img", attrs: { src: "https://example.com/x.png", alt: "그림" }, kids: [] },
      { tag: "img", kids: [] },
    ],
  });
});

test("너무 크거나 깊은 화면은 잘라 올리지 않고 null이다", () => {
  const many = node("div", {}, ...Array.from({ length: 6000 }, () => text("가")));
  assert.equal(dump(many), null);

  let deep = text("끝");
  for (let i = 0; i < 50; i += 1) deep = node("div", {}, deep);
  assert.equal(dump(deep), null);
});

/**
 * 문제 설명은 서버로 가지 않습니다. 도장을 찍는 `submit-code`와 서버에 등록하는 background의
 * `submit`에는 설명이 없어야 하고, 올리는 `push-code`만 싣습니다.
 */
test("문제 설명은 도장을 찍는 요청에 실리지 않는다", () => {
  const card = readFileSync(new URL("../extension/content/card.js", import.meta.url), "utf8");
  const submit = card.match(/type: "submit-code",[\s\S]*?\}\)/)?.[0];
  assert.ok(submit, "submit-code 메시지를 찾지 못했습니다.");
  assert.ok(!/statement|catalog/.test(submit), submit);
  assert.match(card, /type: "push-code",[\s\S]*?statement,/);

  // background는 설명을 열어 보지 않고 push-code 입력을 그대로 올리는 쪽에 넘깁니다.
  const background = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");
  assert.ok(!/statement/.test(background));
});
