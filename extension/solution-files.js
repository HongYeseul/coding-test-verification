/**
 * 저장소에 올릴 파일을 짓습니다. 크롬 API도 네트워크도 쓰지 않아 node 테스트가 그대로 부릅니다.
 *
 * 올리는 것은 본인이 제출한 코드와, 이미 다루는 문제 정보 — 제목·플랫폼·링크·태그 — 뿐입니다.
 * 문제 설명·입출력 예시 같은 플랫폼 콘텐츠는 읽지도 옮기지도 않습니다. 저장소는 공개라
 * 더 그렇습니다.
 */

/** 문제 주소를 폴더로 바꾸는 규칙입니다. 주소는 감지 스크립트가 저장 형식으로 다듬어 넘깁니다. */
const PLATFORMS = [
  {
    host: "school.programmers.co.kr",
    name: "프로그래머스",
    id: /^\/learn\/courses\/30\/lessons\/(\d+)$/,
    // 번호를 앞에 두면 폴더가 번호순으로 줄을 섭니다.
    folder: (id, title) => (title ? `${id}. ${title}` : id),
  },
  {
    host: "neetcode.io",
    name: "NeetCode",
    id: /^\/problems\/([a-z0-9][a-z0-9-]*)$/,
    // 슬러그가 이미 읽히는 이름이라 제목을 덧붙이지 않습니다.
    folder: (id) => id,
  },
];

/**
 * 언어 값을 파일 확장자로 바꿉니다. 프로그래머스 에디터의 data-language와 NeetCode 제출의
 * lang을 함께 받습니다. 모르는 언어는 코드를 잃지 않도록 txt로 둡니다.
 */
const EXTENSIONS = {
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  dart: "dart",
  go: "go",
  java: "java",
  javascript: "js",
  kotlin: "kt",
  mysql: "sql",
  oracle: "sql",
  python: "py",
  python3: "py",
  ruby: "rb",
  rust: "rs",
  scala: "scala",
  swift: "swift",
  typescript: "ts",
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

/**
 * 풀이 한 건을 파일 두 개로 짓습니다. 한 문제가 한 폴더라 같은 문제를 다시 풀면
 * 같은 파일을 덮어써 이력으로 남습니다. 지원하지 않는 주소면 null입니다.
 */
export function solutionFiles({ problemUrl, title, language, code, tags }) {
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
  const extension =
    EXTENSIONS[String(language ?? "").toLowerCase()] ?? "txt";
  // 자바는 관례대로 클래스 이름을 따릅니다. 두 플랫폼 모두 Solution 클래스를 씁니다.
  const file = extension === "java" ? "Solution.java" : `solution.${extension}`;
  const topics = (tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const readme = [
    `# ${name || id}`,
    "",
    `- 플랫폼: ${platform.name}`,
    `- 문제: ${problemUrl}`,
    ...(topics.length ? [`- 태그: ${topics.join(", ")}`] : []),
    "",
  ].join("\n");

  return {
    folder,
    message: `[${platform.name}] ${name || id}`,
    files: [
      {
        path: `${folder}/${file}`,
        content: code.endsWith("\n") ? code : `${code}\n`,
      },
      { path: `${folder}/README.md`, content: readme },
    ],
  };
}
