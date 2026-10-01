/**
 * 저장소에 올릴 파일과 커밋 메시지를 짓습니다. 크롬 API도 네트워크도 쓰지 않아 node 테스트가
 * 그대로 부릅니다.
 *
 * 올리는 것은 본인이 제출한 코드와 채점 결과, 그리고 문제를 가리키는 식별 정보 — 번호·제목·
 * 난이도·링크 — 와 사용자가 적은 태그입니다. 문제 설명 같은 플랫폼 콘텐츠는 올리지 않습니다.
 * 저장소는 공개라 더 그렇습니다.
 *
 * 단 하나의 예외가 프로그래머스 코딩테스트 연습 문제의 설명입니다. 프로그래머스가 공식 안내
 * (고객센터 '프로그래머스의 문제를 외부에 게시할 수 있나요?')에서 광고 없는 GitHub 같은
 * 비상업·비영리 용도로 게시하는 것을 허용하고, 출처를 밝히라고 합니다. 그래서 아래 조건을
 * 모두 지킬 때만 README에 싣습니다. 다른 플랫폼은 그런 허락을 확인하지 못해 싣지 않습니다.
 *   - 분류가 '코딩테스트 연습'입니다. 기업 과제관·선발관 문제는 어떤 경우에도 게시할 수 없습니다.
 *   - 설명에 별도 저작권 표시가 없습니다. 안내가 그런 문제를 제외합니다.
 *   - 설명만 올립니다. 테스트케이스나 채점 환경은 올리지 않습니다.
 *   - 맨 끝에 안내가 정한 출처 문구를 붙입니다.
 */
import { CONFIG } from "./config.js";
import { statementMarkdown } from "./statement.js";

/**
 * 커밋 본문 끝에 남기는 한 줄입니다. 저장소를 보는 사람도 어느 서비스가 올린 커밋인지 알 수
 * 있게 합니다. 주소는 설정을 따라가 로컬에서 올린 커밋에는 로컬 주소가 남습니다.
 */
const SIGNATURE = `Auto-committed by 도장 (${CONFIG.appUrl})`;

/**
 * 문제 주소를 폴더로 바꾸는 규칙입니다. 주소는 감지 스크립트가 저장 형식으로 다듬어 넘깁니다.
 * rank는 감지 스크립트가 넘긴 난이도를 커밋 메시지와 README에 적을 모양으로 바꿉니다.
 */
const PLATFORMS = [
  {
    host: "school.programmers.co.kr",
    name: "프로그래머스",
    id: /^\/learn\/courses\/30\/lessons\/(\d+)$/,
    // 번호를 앞에 두면 폴더가 번호순으로 줄을 섭니다.
    folder: (id, title) => (title ? `${id}. ${title}` : id),
    // 문제 영역에 붙은 숫자입니다. Lv.0 문제도 있습니다.
    rank: (level) => (/^\d{1,2}$/.test(level) ? `Lv.${level}` : ""),
    // 문제 설명을 README에 싣는 조건입니다. 위 머리말을 봅니다.
    statement: {
      catalog: "코딩테스트 연습",
      credit:
        "출처: 프로그래머스 코딩 테스트 연습, https://school.programmers.co.kr/learn/challenges",
    },
  },
  {
    host: "neetcode.io",
    name: "NeetCode",
    id: /^\/problems\/([a-z0-9][a-z0-9-]*)$/,
    // 슬러그가 이미 읽히는 이름이라 제목을 덧붙이지 않습니다.
    folder: (id) => id,
    rank: () => "",
  },
  {
    host: "leetcode.com",
    name: "LeetCode",
    id: /^\/problems\/([a-z0-9][a-z0-9-]*)$/,
    // 번호는 화면에서 읽는 값이라 못 읽을 때가 있습니다. 폴더에 넣으면 같은 문제가 두 폴더로
    // 갈리므로 언제나 있는 슬러그만 씁니다. 번호는 제목(`1. Two Sum`)에 붙어 README와 커밋에 남습니다.
    folder: (id) => id,
    rank: (level) => (["Easy", "Medium", "Hard"].includes(level) ? level : ""),
  },
];

/**
 * 언어 값을 [보여 줄 이름, 파일 확장자]로 바꿉니다. 프로그래머스 에디터의 data-language와
 * NeetCode·LeetCode 제출의 lang을 함께 받습니다. 모르는 언어는 코드를 잃지 않도록 txt로 둡니다.
 * golang·mssql·oraclesql·postgresql·pythondata는 LeetCode가 쓰는 이름입니다.
 */
const LANGUAGES = {
  bash: ["Bash", "sh"],
  c: ["C", "c"],
  cpp: ["C++", "cpp"],
  csharp: ["C#", "cs"],
  dart: ["Dart", "dart"],
  elixir: ["Elixir", "ex"],
  erlang: ["Erlang", "erl"],
  go: ["Go", "go"],
  golang: ["Go", "go"],
  java: ["Java", "java"],
  javascript: ["JavaScript", "js"],
  kotlin: ["Kotlin", "kt"],
  mssql: ["MS SQL Server", "sql"],
  mysql: ["MySQL", "sql"],
  oracle: ["Oracle", "sql"],
  oraclesql: ["Oracle", "sql"],
  php: ["PHP", "php"],
  postgresql: ["PostgreSQL", "sql"],
  python: ["Python", "py"],
  python3: ["Python3", "py"],
  pythondata: ["Pandas", "py"],
  racket: ["Racket", "rkt"],
  ruby: ["Ruby", "rb"],
  rust: ["Rust", "rs"],
  scala: ["Scala", "scala"],
  swift: ["Swift", "swift"],
  typescript: ["TypeScript", "ts"],
};

/** 경로에 쓸 수 없는 글자를 걷어 냅니다. 프로그래머스 제목에는 '/'가 흔히 들어갑니다. */
function folderTitle(title) {
  return title
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 80)
    .trim();
}

/** `4 ms`·`14.9 MB`처럼 단위 앞에 띄어 쓴 값을 `4ms`·`14.9MB`로 붙입니다. 없으면 null입니다. */
function measured(text, unit) {
  const value = String(text ?? "").match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, "i"),
  )?.[1];
  return value ? `${value}${unit}` : null;
}

/**
 * 채점 결과를 줄입니다. 프로그래머스는 통과 칸의 글자(`통과 (0.02ms, 10.2MB)`)를 넘기고,
 * NeetCode는 통과한 테스트 수를, LeetCode는 통과 수와 함께 시간·메모리(`4 ms`·`14.9 MB`)를
 * 넘깁니다. 시간과 메모리는 칸마다 따로 가장 큰 값을 고르고, 플랫폼이 적은 자릿수를 그대로
 * 씁니다. 채점 표가 없는 문제(SQL 등)는 null입니다 — 0을 적으면 실제로 잰 값처럼 보입니다.
 */
export function gradingSummary(grading) {
  const cells = Array.isArray(grading?.cells) ? grading.cells.map(String) : [];
  if (cells.length) {
    let time = null;
    let memory = null;
    for (const cell of cells) {
      const ms = cell.match(/(\d+(?:\.\d+)?)\s*ms/i);
      const mb = cell.match(/(\d+(?:\.\d+)?)\s*MB/i);
      if (ms && (!time || Number(ms[1]) > time.value))
        time = { value: Number(ms[1]), text: `${ms[1]}ms` };
      if (mb && (!memory || Number(mb[1]) > memory.value))
        memory = { value: Number(mb[1]), text: `${mb[1]}MB` };
    }
    return {
      passed: cells.length,
      total: null,
      time: time?.text ?? null,
      memory: memory?.text ?? null,
    };
  }
  const passed = grading?.passed;
  if (Number.isInteger(passed) && passed > 0)
    return {
      passed,
      total: Number.isInteger(grading.total) ? grading.total : passed,
      time: measured(grading.time, "ms"),
      memory: measured(grading.memory, "MB"),
    };
  return null;
}

/** 첫 줄 끝에 붙일 채점 요약입니다. 시간·메모리가 있으면 그것을, 없으면 통과 수를 씁니다. */
function gradingSuffix(summary) {
  if (!summary) return "";
  const measured = [summary.time, summary.memory].filter(Boolean);
  if (measured.length) return ` · ${measured.join(" · ")}`;
  return summary.total ? ` · ${summary.passed}/${summary.total} 통과` : "";
}

/** 설명에 이런 글자가 있으면 별도 저작권 표시가 붙은 문제로 보고 설명을 싣지 않습니다. */
const SEPARATE_COPYRIGHT = /저작권|©|ⓒ|copyright/i;

/**
 * README에 실을 문제 설명(마크다운)을 정합니다. 싣지 않는 경우는 빈 문자열입니다.
 * 플랫폼이 허락한 분류가 아니거나, 별도 저작권 표시가 있거나, 변환할 수 없으면 싣지 않습니다.
 */
function statementFor(platform, { statement, catalog, title }) {
  const rule = platform.statement;
  if (!rule || catalog !== rule.catalog) return "";
  const markdown = statementMarkdown(statement, { title });
  return markdown && !SEPARATE_COPYRIGHT.test(markdown) ? markdown : "";
}

/**
 * 풀이 한 건을 파일 두 개와 커밋 메시지로 짓습니다. 한 문제가 한 폴더라 같은 문제를 다시 풀면
 * 같은 파일을 덮어써 이력으로 남습니다. 지원하지 않는 주소면 null입니다.
 *
 * 커밋 메시지 첫 줄은 GitHub 폴더 목록에도 보이므로 플랫폼·난이도·제목·채점 요약을 담습니다.
 * 예: `[프로그래머스 Lv.2] 가장 큰 수 · 64.31ms · 96.4MB`. 링크·언어·통과 수·태그는 본문에
 * 둡니다. 어느 서비스가 올렸는지는 본문 맨 끝에 한 줄로 적고 첫 줄에는 넣지 않습니다 —
 * 폴더 목록에서 문제 이름보다 서비스 이름이 먼저 읽히면 남의 커밋 이력이 광고처럼 보입니다.
 */
export function solutionFiles({
  problemUrl,
  title,
  language,
  code,
  tags,
  level,
  grading,
  statement,
  catalog,
}) {
  let pathname;
  let platform;
  try {
    const url = new URL(problemUrl);
    platform = PLATFORMS.find((item) => item.host === url.hostname);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const id = platform ? pathname.match(platform.id)?.[1] : null;
  if (!id || !code?.trim()) return null;

  const name = (title ?? "").replace(/\s+/g, " ").trim();
  const folder = `${platform.name}/${platform.folder(id, folderTitle(name))}`;
  const languageKey = String(language ?? "").trim().toLowerCase();
  const [languageName, extension] = LANGUAGES[languageKey] ?? [
    languageKey,
    "txt",
  ];
  // 자바는 관례대로 클래스 이름을 따릅니다. 세 플랫폼 모두 Solution 클래스를 씁니다.
  const file = extension === "java" ? "Solution.java" : `solution.${extension}`;
  const topics = (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const rank = platform.rank(String(level ?? ""));
  const summary = gradingSummary(grading);
  const description = statementFor(platform, { statement, catalog, title: name });

  const readme = [
    `# ${name || id}`,
    "",
    `- 플랫폼: ${platform.name}`,
    ...(rank ? [`- 난이도: ${rank}`] : []),
    `- 문제: ${problemUrl}`,
    ...(topics.length ? [`- 태그: ${topics.join(", ")}`] : []),
    "",
    ...(description
      ? ["## 문제 설명", "", description, "", platform.statement.credit, ""]
      : []),
  ].join("\n");
  const subject = `[${[platform.name, rank].filter(Boolean).join(" ")}] ${name || id}${gradingSuffix(summary)}`;
  const details = [
    `- 문제: ${problemUrl}`,
    ...(languageName ? [`- 언어: ${languageName}`] : []),
    ...(summary ? [`- 채점: 테스트 ${summary.passed}개 통과`] : []),
    ...(topics.length ? [`- 태그: ${topics.join(", ")}`] : []),
  ];

  return {
    folder,
    message: `${subject}\n\n${details.join("\n")}\n\n${SIGNATURE}`,
    files: [
      {
        path: `${folder}/${file}`,
        content: code.endsWith("\n") ? code : `${code}\n`,
      },
      { path: `${folder}/README.md`, content: readme },
    ],
  };
}
