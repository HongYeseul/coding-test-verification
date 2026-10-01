/**
 * 문제 설명이 놓인 화면 영역을 단순한 트리로 떠서 돌려줍니다. 프로그래머스 감지 스크립트가
 * 정답 카드를 띄울 때 한 번 부릅니다.
 *
 * 여기서는 읽은 대로 옮기기만 합니다. 마크다운으로 바꾸고, 올려도 되는 문제인지 가리고,
 * 출처를 붙이는 일은 `statement.js`와 `solution-files.js`가 합니다. 크롬 API 없이 도는 그쪽을
 * node 테스트가 그대로 부르려는 것입니다.
 *
 * 이 트리는 서버로 가지 않습니다. 정답 카드가 `push-code`로 background에 넘기고, 저장소에
 * 올리는 README에만 쓰입니다. 도장을 찍는 `submit-code`에는 싣지 않습니다.
 *
 * 트리 모양: 글자는 문자열, 태그는 `{ tag, attrs?, kids }`입니다. 모르는 태그는 풀어서 안의
 * 내용만 잇고, 스크립트·스타일·입력 요소는 통째로 버립니다. 속성은 링크 주소(href)와 이미지
 * 주소·설명(src·alt)만 남기고, 주소는 절대 주소의 http(s)만 받습니다. 너무 크면 잘라서 올리지
 * 않고 null을 돌려줍니다 — 잘린 문제 설명이 저장소에 남느니 없는 쪽이 낫습니다.
 */
(function () {
  const MAX_NODES = 5000;
  const MAX_DEPTH = 30;

  // 문제 설명에 나오는 태그입니다. 여기 없는 태그는 풀어서 안의 내용만 잇습니다.
  const KEEP = new Set([
    "p", "div", "span", "br", "hr", "pre", "code", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "strong", "b", "em", "i", "sup", "sub", "a", "img",
  ]);
  const DROP = new Set([
    "script", "style", "iframe", "svg", "canvas", "button", "input", "select",
    "textarea", "form", "object", "embed", "noscript", "video", "audio",
    "link", "meta",
  ]);

  /** 절대 주소의 http(s)만 돌려줍니다. 상대 주소는 지금 페이지 기준으로 펼칩니다. */
  function webAddress(value) {
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "http:" || url.protocol === "https:"
        ? url.href
        : "";
    } catch {
      return "";
    }
  }

  function attributes(node, tag) {
    const attrs = {};
    if (tag === "a") {
      const href = webAddress(node.getAttribute("href") ?? "");
      if (href) attrs.href = href;
    } else if (tag === "img") {
      const src = webAddress(node.getAttribute("src") ?? "");
      if (src) attrs.src = src;
      const alt = node.getAttribute("alt");
      if (alt) attrs.alt = alt;
    }
    return attrs;
  }

  window.dojangStatementTree = function dojangStatementTree(root) {
    let count = 0;
    let tooBig = false;

    function kids(node, depth) {
      const found = [];
      for (const child of node.childNodes) {
        const item = convert(child, depth);
        if (item == null) continue;
        // 풀어낸 태그는 배열로 돌아옵니다.
        if (Array.isArray(item)) found.push(...item);
        else found.push(item);
      }
      return found;
    }

    function convert(node, depth) {
      if (tooBig) return null;
      if (++count > MAX_NODES || depth > MAX_DEPTH) {
        tooBig = true;
        return null;
      }
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return null;
      const tag = node.nodeName.toLowerCase();
      if (DROP.has(tag)) return null;
      if (!KEEP.has(tag)) return kids(node, depth + 1);
      const attrs = attributes(node, tag);
      return {
        tag,
        ...(Object.keys(attrs).length ? { attrs } : {}),
        kids: kids(node, depth + 1),
      };
    }

    const tree = { tag: "div", kids: kids(root, 0) };
    return tooBig ? null : tree;
  };
})();
