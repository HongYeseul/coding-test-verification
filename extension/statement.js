/**
 * 문제 설명 트리를 README에 둘 마크다운으로 바꿉니다. 크롬 API도 네트워크도 쓰지 않아 node
 * 테스트가 그대로 부릅니다.
 *
 * 트리는 `content/statement.js`가 화면에서 떠서 넘깁니다. 글자는 문자열, 태그는
 * `{ tag, attrs?, kids }`입니다. 여기서 받은 값은 남의 페이지에서 온 것이라 믿지 않습니다 —
 * 글자는 마크다운이 먹는 기호를 모두 이스케이프해 README에 낯선 서식이나 HTML이 끼어들지
 * 못하게 하고, 링크와 이미지는 http(s) 주소만 받습니다. 우리가 직접 내는 HTML은 위·아래
 * 첨자(`<sup>`·`<sub>`)와 굵게·기울임(`<strong>`·`<em>`), 표 안의 줄바꿈(`<br>`)뿐입니다.
 * 한글 바로 앞뒤에서는 `**굵게**`가 풀리는 일이 있어 굵게·기울임은 HTML 태그로 냅니다.
 *
 * 무엇을 올려도 되는지는 여기서 정하지 않습니다. 그 판단은 `solution-files.js`가 합니다.
 */

/** 이보다 긴 설명은 잘라 올리지 않고 통째로 뺍니다. 잘린 문제 설명은 없느니만 못합니다. */
export const STATEMENT_LIMIT = 30000;

const MAX_DEPTH = 30;

/** 문단 안의 줄바꿈 자리를 표시하는 글자입니다. 문단을 다 짓고 나서 줄바꿈으로 바꿉니다. */
const BREAK = "\u0000";

const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const BLOCKS = new Set([
  "p", "div", "li", "ul", "ol", "table", "pre", "blockquote", "hr", ...HEADINGS,
]);

function isElement(node) {
  return Boolean(node) && typeof node === "object" && typeof node.tag === "string";
}

function children(node) {
  return Array.isArray(node?.kids) ? node.kids : [];
}

function guard(depth) {
  if (depth > MAX_DEPTH) throw new Error("문제 설명 트리가 너무 깊습니다.");
}

/** 안의 글자만 그대로 모읍니다. 코드는 공백과 줄바꿈을 지키려고 이것을 씁니다. */
function rawText(node, depth = 0) {
  guard(depth);
  if (typeof node === "string") return node.replace(/\u0000/g, "");
  if (!isElement(node)) return "";
  if (node.tag === "br") return "\n";
  return children(node)
    .map((kid) => rawText(kid, depth + 1))
    .join("");
}

/** 마크다운이 서식으로 읽을 기호를 글자 그대로 보이게 합니다. */
function escapeText(text) {
  return text
    .replace(/&(?=#?\w+;)/g, "&amp;")
    .replace(/[\\`*_[\]<>|~$]/g, "\\$&");
}

/** http(s) 주소만 돌려줍니다. 그 밖의 것(javascript: 등)은 빈 값입니다. */
function webAddress(value) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

/** 링크 괄호 안에서 뜻을 바꾸는 글자를 퍼센트 인코딩합니다. */
function linkTarget(address) {
  return address.replace(
    /[()\s<>]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );
}

/** 안의 글자 앞뒤 공백은 서식 밖으로 내보냅니다. `** 글 **`은 굵게로 읽히지 않습니다. */
function wrap(open, close, inner) {
  const body = inner.trim();
  if (!body) return inner;
  const lead = inner.match(/^\s*/)[0];
  const trail = inner.match(/\s*$/)[0];
  return `${lead}${open}${body}${close}${trail}`;
}

/** 줄 안의 코드입니다. 코드 안에 백틱이 있으면 더 긴 백틱으로 감쌉니다. */
function codeSpan(text, inTable) {
  let body = text.replace(/\s+/g, " ").trim();
  if (!body) return "";
  // 표 칸 안에서는 `|`가 칸을 가릅니다. 코드 안이라도 이스케이프해야 합니다.
  if (inTable) body = body.replace(/\|/g, "\\|");
  const longest = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  const pad = body.startsWith("`") || body.endsWith("`") ? " " : "";
  return `${fence}${pad}${body}${pad}${fence}`;
}

function inline(nodes, ctx, depth) {
  return nodes.map((node) => inlineNode(node, ctx, depth)).join("");
}

function inlineNode(node, ctx, depth) {
  guard(depth);
  if (typeof node === "string")
    return escapeText(node.replace(/\u0000/g, "").replace(/\s+/g, " "));
  if (!isElement(node)) return "";
  const inner = () => inline(children(node), ctx, depth + 1);
  switch (node.tag) {
    case "br":
      return ctx.inTable ? "<br>" : BREAK;
    case "code":
      return codeSpan(rawText(node), ctx.inTable);
    case "strong":
    case "b":
      return wrap("<strong>", "</strong>", inner());
    case "em":
    case "i":
      return wrap("<em>", "</em>", inner());
    case "sup":
    case "sub": {
      const text = inner().trim();
      return text ? `<${node.tag}>${text}</${node.tag}>` : "";
    }
    case "a": {
      const text = inner().trim();
      if (!text) return "";
      const href = webAddress(node.attrs?.href);
      return href ? `[${text}](${linkTarget(href)})` : text;
    }
    case "img": {
      const src = webAddress(node.attrs?.src);
      if (!src) return "";
      const alt = escapeText(String(node.attrs?.alt ?? "").replace(/\s+/g, " ").trim());
      return `![${alt}](${linkTarget(src)})`;
    }
    default:
      // 문단 같은 덩이가 인라인 자리에 끼어 있으면 앞뒤가 붙지 않게 띄웁니다.
      return BLOCKS.has(node.tag)
        ? `${inner()}${ctx.inTable ? "<br>" : " "}`
        : inner();
  }
}

/** 줄 맨 앞에 와서 목록·제목·구분선으로 읽힐 글자를 글자 그대로 보이게 합니다. */
function escapeLineStart(line) {
  return line
    .replace(/^#{1,6}(?=\s|$)/, "\\$&")
    .replace(/^[-+](?=\s|$)/, "\\$&")
    .replace(/^(\d+)([.)])(?=\s|$)/, "$1\\$2")
    .replace(/^(?==+$|-{2,}$)/, "\\");
}

/** 인라인 글자를 문단으로 만듭니다. 줄바꿈 자리는 마크다운 강제 줄바꿈이 됩니다. */
function paragraph(text) {
  const lines = text
    .split(BREAK)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines.map(escapeLineStart).join("\\\n");
}

/** 노드 목록을 덩이(문단·목록·표 …)들로 나눕니다. 덩이 사이에 빈 줄이 들어갑니다. */
function blocks(nodes, ctx, depth) {
  guard(depth);
  const found = [];
  let run = [];
  const flush = () => {
    const text = paragraph(inline(run, ctx, depth));
    if (text) found.push(text);
    run = [];
  };
  for (const node of nodes) {
    if (isElement(node) && BLOCKS.has(node.tag)) {
      flush();
      found.push(...block(node, ctx, depth + 1));
    } else {
      run.push(node);
    }
  }
  flush();
  return found;
}

function block(node, ctx, depth) {
  guard(depth);
  if (HEADINGS.has(node.tag)) {
    // README 맨 위가 제목이라 설명 안의 제목은 모두 같은 단계로 둡니다.
    const text = inline(children(node), ctx, depth + 1)
      .replaceAll(BREAK, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text ? [`### ${text}`] : [];
  }
  switch (node.tag) {
    case "ul":
    case "ol": {
      const list = listBlock(node, ctx, depth);
      return list ? [list] : [];
    }
    case "table": {
      const table = tableBlock(node, depth);
      return table ? [table] : [];
    }
    case "pre": {
      const text = rawText(node)
        .replace(/\r\n?/g, "\n")
        .replace(/^\n+|\s+$/g, "");
      if (!text.trim()) return [];
      const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
      const fence = "`".repeat(Math.max(3, longest + 1));
      return [`${fence}\n${text}\n${fence}`];
    }
    case "blockquote": {
      const inner = blocks(children(node), ctx, depth + 1).join("\n\n");
      if (!inner) return [];
      return [inner.split("\n").map((line) => (line ? `> ${line}` : ">")).join("\n")];
    }
    case "hr":
      return ["---"];
    default:
      // p, div, li가 목록 밖에 떨어진 경우입니다.
      return blocks(children(node), ctx, depth + 1);
  }
}

function listBlock(node, ctx, depth) {
  const ordered = node.tag === "ol";
  const lines = [];
  let number = 0;
  for (const item of children(node)) {
    if (!isElement(item) || item.tag !== "li") continue;
    const parts = blocks(children(item), ctx, depth + 1);
    if (!parts.length) continue;
    const marker = ordered ? `${++number}. ` : "- ";
    const pad = " ".repeat(marker.length);
    // 안에 든 목록은 바로 이어 붙이고, 문단은 빈 줄로 띄웁니다. 빈 줄이 없으면 한 문단으로 합쳐집니다.
    let body = parts[0];
    for (const part of parts.slice(1))
      body += `${/^(- |\d+\. )/.test(part) ? "\n" : "\n\n"}${part}`;
    lines.push(
      body
        .split("\n")
        .map((line, index) => (index === 0 ? `${marker}${line}` : line ? `${pad}${line}` : line))
        .join("\n"),
    );
  }
  return lines.join("\n");
}

function tableBlock(node, depth) {
  const rows = [];
  const collect = (parent) => {
    for (const kid of children(parent)) {
      if (!isElement(kid)) continue;
      if (kid.tag === "tr") rows.push(kid);
      else if (["thead", "tbody", "tfoot"].includes(kid.tag)) collect(kid);
    }
  };
  collect(node);

  const ctx = { inTable: true };
  const grid = rows
    .map((row) =>
      children(row)
        .filter((cell) => isElement(cell) && (cell.tag === "td" || cell.tag === "th"))
        .map((cell) =>
          inline(children(cell), ctx, depth + 1)
            .replace(/\s+/g, " ")
            .replace(/(\s*<br>\s*)+$/, "")
            .trim(),
        ),
    )
    .filter((cells) => cells.length);
  const width = Math.max(0, ...grid.map((cells) => cells.length));
  if (!width) return "";

  const line = (cells) =>
    `| ${[...cells, ...Array(width - cells.length).fill("")].join(" | ")} |`;
  const [header, ...body] = grid;
  return [line(header), line(Array(width).fill("---")), ...body.map(line)].join("\n");
}

/**
 * 문제 설명 트리를 마크다운으로 바꿉니다. 비었거나 너무 길거나 모양이 틀리면 빈 문자열입니다.
 * title과 같은 첫 제목은 README 맨 위 제목과 겹치므로 뺍니다.
 */
export function statementMarkdown(tree, { title } = {}) {
  try {
    if (!isElement(tree)) return "";
    const parts = blocks(children(tree), { inTable: false }, 0);
    const name = escapeText(String(title ?? "").replace(/\s+/g, " ").trim());
    if (name && parts[0] === `### ${name}`) parts.shift();
    const markdown = parts.join("\n\n").trim();
    return markdown.length > STATEMENT_LIMIT ? "" : markdown;
  } catch {
    return "";
  }
}
