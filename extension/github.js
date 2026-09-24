import { signInWithScopes } from "./auth.js";
import { solutionFiles } from "./solution-files.js";

const GITHUB_KEY = "dojang.github";
const API = "https://api.github.com";

/**
 * 저장소에 쓰는 권한입니다. OAuth 앱 권한은 저장소 하나로 좁힐 수 없어 공개 저장소 쓰기만
 * 받습니다. 비공개 저장소까지 쓰려면 repo를 받아야 하는데, 그건 모든 비공개 저장소를 여는
 * 권한입니다.
 */
export const REPO_SCOPE = "public_repo";

/** GitHub API가 거절한 요청입니다. 상태 코드로 무엇을 안내할지 가립니다. */
export class GithubError extends Error {
  constructor(status, message) {
    super(message || `GitHub 요청이 실패했습니다 (${status}).`);
    this.status = status;
  }
}

/**
 * api.github.com은 어느 오리진에나 CORS를 열어 두어 사이트 권한 없이 부를 수 있습니다.
 * 쿠키는 보내지 않고 토큰만 씁니다.
 */
async function send(token, path, { method = "GET", body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new GithubError(response.status, data?.message);
  return { data, response };
}

async function api(token, path, options) {
  return (await send(token, path, options)).data;
}

/** 화면에 적는 저장소 이름입니다. */
export function repoName(repo) {
  return `${repo.owner}/${repo.name}`;
}

function repoPath(repo) {
  return `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
}

/** 경로의 마디마다 따로 인코딩합니다. 폴더 이름에 한글과 공백이 들어갑니다. */
function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function toBase64(text) {
  let binary = "";
  for (const byte of new TextEncoder().encode(text))
    binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toRepo(data) {
  return { owner: data.owner.login, name: data.name };
}

/** 연결 상태입니다. `{ token, login, repo }`이고, 토큰이 거절되면 token만 비웁니다. */
export async function getGithub() {
  return (await chrome.storage.local.get(GITHUB_KEY))[GITHUB_KEY] ?? null;
}

async function saveGithub(github) {
  await chrome.storage.local.set({ [GITHUB_KEY]: github });
}

/**
 * 확장이 가진 토큰과 고른 저장소를 버립니다. 토큰을 GitHub에서 폐기하려면 client secret이
 * 있어야 해서 여기서는 못 합니다. 권한까지 거두려면 GitHub 설정에서 지웁니다.
 */
export async function disconnectGithub() {
  await chrome.storage.local.remove(GITHUB_KEY);
}

/**
 * 저장소에 쓸 권한을 받아 연결합니다. 로그인 창을 띄우므로 background에서만 부릅니다 —
 * 팝업은 포커스를 잃으면 닫혀, 창이 돌아오기 전에 받을 곳이 사라집니다.
 *
 * 같은 계정으로 다시 연결하면 전에 고른 저장소를 그대로 둡니다. 다시 연결하는 것은
 * 대개 토큰이 거절됐을 때라, 저장소까지 다시 고르게 하지 않으려는 것입니다.
 */
export async function connectGithub() {
  const token = await signInWithScopes(REPO_SCOPE);
  const { data: user, response } = await send(token, "/user");
  // 권한이 빠진 토큰이면 올릴 때마다 실패하므로 여기서 멈춥니다.
  const scopes = response.headers.get("X-OAuth-Scopes");
  if (
    scopes !== null &&
    !scopes
      .split(",")
      .map((scope) => scope.trim())
      .some((scope) => scope === "public_repo" || scope === "repo")
  )
    throw new Error("저장소에 쓸 권한을 받지 못했습니다. 다시 연결해주세요.");
  const previous = await getGithub();
  const repo = previous?.login === user.login ? previous.repo : null;
  await saveGithub({ token, login: user.login, repo });
  return { login: user.login, repo: repo ? repoName(repo) : null };
}

/** 풀이를 올릴 수 있는 공개 저장소를 최근에 푸시한 순으로 100개까지 가져옵니다. */
export async function listRepos() {
  return withToken(async (token) => {
    const repos = await api(token, "/user/repos?per_page=100&sort=pushed");
    return repos
      .filter(
        (repo) => repo.permissions?.push && !repo.archived && !repo.private,
      )
      .map(toRepo);
  });
}

/** 공개 저장소를 새로 만듭니다. README를 넣어 만들어 처음부터 브랜치가 있게 합니다. */
export async function createRepo(name) {
  return withToken(async (token) => {
    try {
      return toRepo(
        await api(token, "/user/repos", {
          method: "POST",
          body: { name, auto_init: true },
        }),
      );
    } catch (error) {
      if (error instanceof GithubError && error.status === 422)
        throw new Error("같은 이름의 저장소가 있거나 쓸 수 없는 이름입니다.");
      throw error;
    }
  });
}

export async function chooseRepo(repo) {
  const github = await getGithub();
  if (!github) return;
  await saveGithub({ ...github, repo: { owner: repo.owner, name: repo.name } });
}

/** 올릴 곳이 정해져 있으면 그 이름을, 아니면 null을 돌려줍니다. 카드가 올릴지 정합니다. */
export async function uploadTarget() {
  const github = await getGithub();
  return github?.token && github.repo ? repoName(github.repo) : null;
}

/**
 * 도장을 찍은 풀이를 고른 저장소에 올립니다. 도장과 따로 가므로 여기서 실패해도 도장은
 * 남습니다. 돌려주는 주소는 그 문제의 폴더입니다.
 */
export async function uploadSolution(input) {
  const solution = solutionFiles(input);
  if (!solution)
    throw new Error("이 문제는 저장소에 둘 자리를 정하지 못했습니다.");
  return withToken(async (token, github) => {
    if (!github.repo) throw new Error("팝업에서 올릴 저장소를 먼저 골라주세요.");
    const { branch, unchanged } = await commitFiles(
      token,
      github.repo,
      solution.files,
      solution.message,
    );
    return {
      repo: repoName(github.repo),
      url: `https://github.com/${encodePath(repoName(github.repo))}/tree/${encodePath(branch)}/${encodePath(solution.folder)}`,
      unchanged: Boolean(unchanged),
    };
  });
}

/**
 * 파일 여러 개를 커밋 하나로 올립니다. 원격 브랜치를 바로 옮기므로 따로 push할 것이 없습니다.
 *
 * 내용 API는 파일 하나에 커밋 하나라, 코드와 README를 함께 올리려고 Git 데이터 API로
 * 트리를 짓습니다. 트리가 그대로면(같은 코드로 다시 찍은 경우) 커밋하지 않습니다.
 */
export async function commitFiles(token, repo, files, message) {
  const base = repoPath(repo);
  const info = await api(token, base);
  // 목록에서 고른 뒤 권한이 바뀌었을 수 있습니다. 트리를 짓기 전에 멈춥니다.
  if (info.permissions && !info.permissions.push) throw new GithubError(403);
  const branch = info.default_branch;

  let pending = files;
  let head = await branchHead(token, base, branch);
  if (!head) {
    // 빈 저장소는 Git 데이터 API가 받지 않습니다(409). 첫 파일을 내용 API로 만들어
    // 브랜치를 틔우고 나머지를 이어 올립니다. 이때만 커밋이 둘이 됩니다.
    const [first, ...rest] = files;
    const created = await api(
      token,
      `${base}/contents/${encodePath(first.path)}`,
      { method: "PUT", body: { message, content: toBase64(first.content) } },
    );
    if (!rest.length) return { branch, sha: created.commit.sha };
    pending = rest;
    head = await branchHead(token, base, branch);
    if (!head) throw new GithubError(409);
  }

  // 그 사이 다른 커밋이 들어와 브랜치가 앞서 나갔으면 한 번만 다시 합니다.
  for (let attempt = 1; ; attempt += 1) {
    const tree = await api(token, `${base}/git/trees`, {
      method: "POST",
      body: {
        base_tree: head.tree,
        tree: pending.map((file) => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.content,
        })),
      },
    });
    if (tree.sha === head.tree) return { branch, unchanged: true };
    const commit = await api(token, `${base}/git/commits`, {
      method: "POST",
      body: { message, tree: tree.sha, parents: [head.sha] },
    });
    try {
      await api(token, `${base}/git/refs/heads/${encodePath(branch)}`, {
        method: "PATCH",
        body: { sha: commit.sha },
      });
      return { branch, sha: commit.sha };
    } catch (error) {
      const moved = error instanceof GithubError && error.status === 422;
      if (!moved || attempt >= 2) throw error;
      head = await branchHead(token, base, branch);
    }
  }
}

/** 브랜치 끝 커밋과 그 트리입니다. 빈 저장소면 null입니다. */
async function branchHead(token, base, branch) {
  try {
    const ref = await api(token, `${base}/git/ref/heads/${encodePath(branch)}`);
    const commit = await api(token, `${base}/git/commits/${ref.object.sha}`);
    return { sha: commit.sha, tree: commit.tree.sha };
  } catch (error) {
    if (error instanceof GithubError && error.status === 409) return null;
    throw error;
  }
}

/**
 * 저장된 토큰으로 일을 합니다. GitHub가 토큰을 거절하면(401) 토큰만 버리고 고른 저장소는
 * 남깁니다. 같은 계정으로 다시 연결하면 그대로 이어 씁니다.
 */
async function withToken(work) {
  const github = await getGithub();
  if (!github?.token)
    throw new Error("팝업에서 GitHub 저장소를 먼저 연결해주세요.");
  try {
    return await work(github.token, github);
  } catch (error) {
    if (error instanceof GithubError && error.status === 401) {
      await saveGithub({ ...github, token: null });
      throw new Error(
        "GitHub 연결이 풀렸습니다. 팝업에서 저장소를 다시 연결해주세요.",
      );
    }
    throw new Error(explain(error));
  }
}

/** GitHub가 거절한 까닭을 다음에 할 일로 바꿔 말합니다. */
function explain(error) {
  if (error instanceof GithubError) {
    if (error.status === 403 && /rate limit/i.test(error.message))
      return "GitHub 요청 한도를 넘었습니다. 잠시 뒤 다시 시도해주세요.";
    if (error.status === 403 || error.status === 404)
      return "이 저장소에 쓸 수 없습니다. 팝업에서 저장소를 다시 골라주세요.";
    if (error.status === 409 || error.status === 422)
      return "그 사이 저장소가 바뀌어 올리지 못했습니다. 다시 시도해주세요.";
    return "GitHub가 요청을 받지 않았습니다. 잠시 뒤 다시 시도해주세요.";
  }
  // fetch 자체가 실패하면 TypeError가 옵니다.
  if (error instanceof TypeError)
    return "GitHub에 닿지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.";
  return error?.message || "GitHub에 올리지 못했습니다.";
}
