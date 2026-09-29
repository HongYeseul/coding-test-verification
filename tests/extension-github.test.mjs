import test from "node:test";
import assert from "node:assert/strict";

import { CONFIG } from "../extension/config.js";
import {
  chooseRepoByName,
  commitFiles,
  connectGithub,
  createAndChooseRepo,
  GithubError,
  githubState,
  repoNames,
  uploadSolution,
} from "../extension/github.js";

/**
 * 저장소에 올리는 순서를 가짜 GitHub로 검사합니다.
 *
 * 코드와 README는 커밋 하나로 들어가야 하고, 원격 브랜치를 바로 옮기므로 push 단계가
 * 따로 없습니다. 빈 저장소와 그 사이 다른 커밋이 들어온 저장소는 순서가 달라집니다.
 */
const REPO = { owner: "yeseul", name: "algo" };
const BASE = "/repos/yeseul/algo";
const FILES = [
  { path: "프로그래머스/42576. 완주하지 못한 선수/solution.py", content: "print(1)\n" },
  { path: "프로그래머스/42576. 완주하지 못한 선수/README.md", content: "# 완주하지 못한 선수\n" },
];

/**
 * api.github.com을 흉내 냅니다. 무엇을 어떤 순서로 불렀는지 적어 둡니다.
 *   empty    — 커밋이 하나도 없는 저장소
 *   moved    — 브랜치를 옮기려 할 때 그 사이 다른 커밋이 끼어드는 횟수
 *   sameTree — 새로 지은 트리가 지금 트리와 같음(같은 코드로 다시 찍음)
 *   canPush  — 이 저장소에 쓸 권한
 *   status   — 모든 요청을 이 상태로 거절
 *
 * 브라우저 캐시도 흉내 냅니다. GitHub는 읽기 응답에 `max-age=60`을 붙여, fetch가 cache를
 * 따로 정하지 않으면 1분 안의 같은 GET에 GitHub 대신 처음 받은 응답을 돌려줍니다. 브랜치는
 * 새 커밋의 부모가 지금 끝일 때만 옮겨집니다(fast forward).
 */
function fakeGithub({
  empty = false,
  moved = 0,
  sameTree = false,
  canPush = true,
  status,
} = {}) {
  const calls = [];
  // 커밋마다 트리와 부모를 기억합니다. 캐시에서 옛 끝을 받았을 때도 그 커밋을 읽을 수 있습니다.
  const commits = new Map([["c1", { tree: "t1" }]]);
  let head = empty ? null : { sha: "c1", tree: "t1" };
  let trees = 0;
  const cached = new Map();

  globalThis.fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    const path = decodeURI(String(url).replace("https://api.github.com", ""));
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body, auth: init.headers?.Authorization, cache: init.cache });
    const reply = (code, data) => {
      if (method === "GET" && code === 200 && init.cache !== "no-store")
        cached.set(path, data);
      return new Response(JSON.stringify(data), { status: code });
    };
    // 캐시 방식을 정하지 않은 GET은 1분 안이면 GitHub에 묻지 않고 처음 받은 응답을 씁니다.
    if (method === "GET" && (init.cache ?? "default") === "default" && cached.has(path))
      return new Response(JSON.stringify(cached.get(path)), { status: 200 });

    if (status) return reply(status, { message: "Bad credentials" });
    if (method === "GET" && path === BASE)
      return reply(200, { default_branch: "main", permissions: { push: canPush } });
    if (method === "GET" && path === `${BASE}/git/ref/heads/main`)
      return head
        ? reply(200, { object: { sha: head.sha } })
        : reply(409, { message: "Git Repository is empty." });
    const sha = path.slice(`${BASE}/git/commits/`.length);
    if (method === "GET" && path.startsWith(`${BASE}/git/commits/`) && commits.has(sha))
      return reply(200, { sha, tree: { sha: commits.get(sha).tree } });
    if (method === "PUT" && path.startsWith(`${BASE}/contents/`)) {
      commits.set("c0", { tree: "t0" });
      head = { sha: "c0", tree: "t0" };
      return reply(201, { commit: { sha: "c0" } });
    }
    if (method === "POST" && path === `${BASE}/git/trees`) {
      trees += 1;
      return reply(201, { sha: sameTree ? body.base_tree : `new-tree-${trees}` });
    }
    if (method === "POST" && path === `${BASE}/git/commits`) {
      const made = `new-commit-${trees}`;
      commits.set(made, { tree: body.tree, parent: body.parents[0] });
      return reply(201, { sha: made });
    }
    if (method === "PATCH" && path === `${BASE}/git/refs/heads/main`) {
      if (moved > 0) {
        moved -= 1;
        commits.set("c9", { tree: "t9" });
        head = { sha: "c9", tree: "t9" };
        return reply(422, { message: "Update is not a fast forward" });
      }
      // 새 커밋이 지금 끝 위에 지어지지 않았으면 옮기지 않습니다.
      if (commits.get(body.sha)?.parent !== head.sha)
        return reply(422, { message: "Update is not a fast forward" });
      head = { sha: body.sha, tree: commits.get(body.sha).tree };
      return reply(200, { object: { sha: body.sha } });
    }
    return reply(404, { message: "Not Found" });
  };
  return calls;
}

const steps = (calls) => calls.map((call) => `${call.method} ${call.path}`);

test("코드와 README를 커밋 하나로 올리고 브랜치를 옮긴다", async () => {
  const calls = fakeGithub();
  const result = await commitFiles("gho_token", REPO, FILES, "[프로그래머스] 완주하지 못한 선수");

  assert.deepEqual(result, { branch: "main", sha: "new-commit-1" });
  assert.deepEqual(steps(calls), [
    `GET ${BASE}`,
    `GET ${BASE}/git/ref/heads/main`,
    `GET ${BASE}/git/commits/c1`,
    `POST ${BASE}/git/trees`,
    `POST ${BASE}/git/commits`,
    `PATCH ${BASE}/git/refs/heads/main`,
  ]);
  const [, , , tree, commit, ref] = calls;
  assert.equal(tree.body.base_tree, "t1");
  assert.deepEqual(
    tree.body.tree,
    FILES.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content })),
  );
  assert.deepEqual(commit.body, {
    message: "[프로그래머스] 완주하지 못한 선수",
    tree: "new-tree-1",
    parents: ["c1"],
  });
  assert.deepEqual(ref.body, { sha: "new-commit-1" });
  assert.ok(calls.every((call) => call.auth === "Bearer gho_token"));
});

test("같은 코드로 다시 찍어 트리가 그대로면 커밋하지 않는다", async () => {
  const calls = fakeGithub({ sameTree: true });
  const result = await commitFiles("t", REPO, FILES, "m");

  assert.deepEqual(result, { branch: "main", unchanged: true });
  assert.ok(!steps(calls).includes(`POST ${BASE}/git/commits`));
  assert.ok(!steps(calls).some((step) => step.startsWith("PATCH")));
});

test("빈 저장소는 첫 파일로 브랜치를 틔우고 나머지를 이어 올린다", async () => {
  const calls = fakeGithub({ empty: true });
  const result = await commitFiles("t", REPO, FILES, "m");

  assert.deepEqual(result, { branch: "main", sha: "new-commit-1" });
  const put = calls.find((call) => call.method === "PUT");
  assert.equal(put.path, `${BASE}/contents/${FILES[0].path}`);
  // 내용 API는 base64를 받습니다. 한글 경로와 본문이 UTF-8 그대로 가야 합니다.
  assert.equal(Buffer.from(put.body.content, "base64").toString("utf8"), FILES[0].content);
  const tree = calls.find((call) => call.path === `${BASE}/git/trees`);
  assert.equal(tree.body.base_tree, "t0");
  assert.deepEqual(tree.body.tree.map((entry) => entry.path), [FILES[1].path]);
});

test("그 사이 다른 커밋이 들어와 브랜치가 앞서 나갔으면 한 번 다시 한다", async () => {
  const calls = fakeGithub({ moved: 1 });
  const result = await commitFiles("t", REPO, FILES, "m");

  assert.deepEqual(result, { branch: "main", sha: "new-commit-2" });
  const commits = calls.filter((call) => call.path === `${BASE}/git/commits` && call.method === "POST");
  // 다시 할 때는 새로 앞선 커밋 위에 짓습니다.
  assert.deepEqual(commits.map((call) => call.body.parents), [["c1"], ["c9"]]);
});

test("한 문제를 올리고 1분 안에 다음 문제를 올려도 브랜치 끝을 새로 읽는다", async () => {
  // GitHub 읽기 응답은 max-age=60입니다. 브라우저 캐시를 그대로 쓰면 두 번째 올리기가 방금 옮긴
  // 끝이 아니라 그 전 끝 위에 커밋을 지어 브랜치를 옮기지 못했고, 다시 읽어도 같은 옛 값이라
  // ‘그 사이 저장소가 바뀌어 올리지 못했습니다’로 끝났습니다(0.2.12, 사용자 제보).
  const calls = fakeGithub();
  await commitFiles("t", REPO, FILES, "첫 문제");
  const second = await commitFiles(
    "t",
    REPO,
    [{ path: "LeetCode/two-sum/solution.cpp", content: "x\n" }],
    "다음 문제",
  );

  assert.deepEqual(second, { branch: "main", sha: "new-commit-2" });
  const parents = calls
    .filter((call) => call.path === `${BASE}/git/commits` && call.method === "POST")
    .map((call) => call.body.parents);
  assert.deepEqual(parents, [["c1"], ["new-commit-1"]]);
  // GitHub에 가는 요청은 모두 캐시를 믿지 않고 되묻습니다.
  assert.ok(calls.every((call) => call.cache === "no-cache"));
});

test("두 번 연달아 밀리면 덮어쓰지 않고 멈춘다", async () => {
  fakeGithub({ moved: 2 });
  await assert.rejects(commitFiles("t", REPO, FILES, "m"), (error) => {
    assert.ok(error instanceof GithubError);
    assert.equal(error.status, 422);
    return true;
  });
});

test("쓸 권한이 없는 저장소에는 트리를 짓기 전에 멈춘다", async () => {
  const calls = fakeGithub({ canPush: false });
  await assert.rejects(commitFiles("t", REPO, FILES, "m"), (error) => error.status === 403);
  assert.deepEqual(steps(calls), [`GET ${BASE}`]);
});

/** chrome.storage.local을 흉내 냅니다. */
function fakeStorage(initial) {
  const store = { ...initial };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => (key in store ? { [key]: store[key] } : {}),
        set: async (items) => Object.assign(store, items),
        remove: async (key) => delete store[key],
      },
    },
  };
  return store;
}

const SOLUTION = {
  problemUrl: "https://school.programmers.co.kr/learn/courses/30/lessons/42576",
  title: "완주하지 못한 선수",
  language: "python3",
  code: "print(1)",
  tags: "해시",
};

test("올리면 그 문제의 폴더 주소를 돌려준다", async () => {
  fakeStorage({ "dojang.github": { token: "t", login: "yeseul", repo: REPO } });
  fakeGithub();
  const result = await uploadSolution(SOLUTION);

  assert.equal(result.repo, "yeseul/algo");
  assert.equal(result.unchanged, false);
  assert.equal(
    decodeURI(result.url),
    "https://github.com/yeseul/algo/tree/main/프로그래머스/42576. 완주하지 못한 선수",
  );
});

test("GitHub가 토큰을 거절하면 토큰만 버리고 고른 저장소는 남긴다", async () => {
  const store = fakeStorage({ "dojang.github": { token: "t", login: "yeseul", repo: REPO } });
  fakeGithub({ status: 401 });

  await assert.rejects(uploadSolution(SOLUTION), /다시 연결/);
  assert.deepEqual(store["dojang.github"], { token: null, login: "yeseul", repo: REPO });
});

test("저장소를 연결하지 않았으면 GitHub를 부르지 않는다", async () => {
  fakeStorage({});
  const calls = fakeGithub();

  await assert.rejects(uploadSolution(SOLUTION), /먼저 연결/);
  assert.equal(calls.length, 0);
});

/**
 * 저장소 연결은 같은 Supabase GitHub 로그인에 권한만 더해 한 번 더 거칩니다.
 * 로그인 창과 토큰 교환, GitHub의 /user를 흉내 냅니다.
 */
function fakeSignIn(store, { providerToken = "gho_new", scopes = "public_repo, user:email", login = "yeseul" } = {}) {
  const opened = [];
  globalThis.chrome.identity = {
    getRedirectURL: () => "https://pkpabpnpecgcpakaehojnphgeajoieih.chromiumapp.org/",
    launchWebAuthFlow: async ({ url }) => {
      opened.push(new URL(url));
      return "https://pkpabpnpecgcpakaehojnphgeajoieih.chromiumapp.org/?code=auth-code";
    },
  };
  globalThis.fetch = async (url) => {
    const address = String(url);
    if (address === `${CONFIG.supabaseUrl}/auth/v1/token?grant_type=pkce`)
      return new Response(
        JSON.stringify({
          access_token: "supabase-access",
          refresh_token: "supabase-refresh",
          expires_in: 3600,
          ...(providerToken ? { provider_token: providerToken } : {}),
        }),
        { status: 200 },
      );
    if (address === "https://api.github.com/user")
      return new Response(JSON.stringify({ login }), {
        status: 200,
        headers: { "X-OAuth-Scopes": scopes },
      });
    return new Response("{}", { status: 404 });
  };
  return { opened, store };
}

test("연결하면 공개 저장소 쓰기 권한을 청하고 GitHub가 준 토큰을 간직한다", async () => {
  const store = fakeStorage({});
  const { opened } = fakeSignIn(store);

  assert.deepEqual(await connectGithub(), { login: "yeseul", repo: null });
  assert.equal(opened.length, 1);
  assert.equal(opened[0].searchParams.get("provider"), "github");
  assert.equal(opened[0].searchParams.get("scopes"), "public_repo");
  assert.deepEqual(store["dojang.github"], { token: "gho_new", login: "yeseul", repo: null });
  // 권한을 더 받으며 새로 받은 도장 세션도 간직합니다.
  assert.equal(store["dojang.session"].accessToken, "supabase-access");
});

test("같은 계정으로 다시 연결하면 고른 저장소를 그대로 둔다", async () => {
  const store = fakeStorage({ "dojang.github": { token: null, login: "yeseul", repo: REPO } });
  fakeSignIn(store);

  assert.deepEqual(await connectGithub(), { login: "yeseul", repo: "yeseul/algo" });
  assert.deepEqual(store["dojang.github"], { token: "gho_new", login: "yeseul", repo: REPO });
});

test("다른 계정으로 연결하면 저장소를 다시 고르게 한다", async () => {
  const store = fakeStorage({ "dojang.github": { token: null, login: "yeseul", repo: REPO } });
  fakeSignIn(store, { login: "friend" });

  assert.deepEqual(await connectGithub(), { login: "friend", repo: null });
  assert.equal(store["dojang.github"].repo, null);
});

test("저장소 권한이 빠진 토큰이면 연결하지 않는다", async () => {
  const store = fakeStorage({});
  fakeSignIn(store, { scopes: "user:email, repo:status" });

  await assert.rejects(connectGithub(), /권한을 받지 못했습니다/);
  assert.equal(store["dojang.github"], undefined);
});

test("GitHub 토큰이 응답에 없으면 연결하지 않는다", async () => {
  const store = fakeStorage({});
  fakeSignIn(store, { providerToken: null });

  await assert.rejects(connectGithub(), /GitHub 권한을 받지 못했습니다/);
  assert.equal(store["dojang.github"], undefined);
});

/**
 * 카드의 저장소 줄이 background에 부탁하는 일들입니다. 카드는 남의 페이지에 붙어 있으니
 * 토큰을 받지 않고, 보내오는 이름도 믿지 않습니다.
 */
test("카드에 주는 상태에는 토큰이 없다", async () => {
  fakeStorage({ "dojang.github": { token: "secret", login: "yeseul", repo: REPO } });

  assert.deepEqual(await githubState(), {
    connected: true,
    repo: "yeseul/algo",
    url: "https://github.com/yeseul/algo",
  });

  fakeStorage({ "dojang.github": { token: null, login: "yeseul", repo: REPO } });
  assert.equal((await githubState()).connected, false);
  assert.equal((await githubState()).repo, "yeseul/algo");

  fakeStorage({});
  assert.deepEqual(await githubState(), { connected: false, repo: null, url: null });
});

test("카드가 고른 저장소는 이름 모양을 다시 보고 정한다", async () => {
  const store = fakeStorage({ "dojang.github": { token: "t", login: "yeseul", repo: null } });

  const state = await chooseRepoByName("yeseul/algo.solutions");
  assert.equal(state.repo, "yeseul/algo.solutions");
  assert.deepEqual(store["dojang.github"].repo, { owner: "yeseul", name: "algo.solutions" });

  for (const bad of ["", "algo", "a/b/c", "../etc/passwd", "yeseul/algo?x=1", "yeseul /algo"])
    await assert.rejects(chooseRepoByName(bad), /이름을 확인/, bad);
});

test("연결하지 않았으면 카드에서 저장소를 고를 수 없다", async () => {
  fakeStorage({});
  await assert.rejects(chooseRepoByName("yeseul/algo"), /먼저 연결/);
});

test("카드의 저장소 목록은 쓸 수 있는 공개 저장소 이름만 보낸다", async () => {
  fakeStorage({ "dojang.github": { token: "t", login: "yeseul", repo: null } });
  const repo = (name, extra = {}) => ({
    owner: { login: "yeseul" },
    name,
    permissions: { push: true },
    archived: false,
    private: false,
    ...extra,
  });
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        repo("algo"),
        repo("diary", { private: true }),
        repo("old", { archived: true }),
        repo("readonly", { permissions: { push: false } }),
      ]),
      { status: 200 },
    );

  assert.deepEqual(await repoNames(), { repos: ["yeseul/algo"] });
});

test("카드에서 만든 저장소를 바로 올릴 곳으로 정한다", async () => {
  const store = fakeStorage({ "dojang.github": { token: "t", login: "yeseul", repo: null } });
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    sent.push({ url: String(url), method: init.method, body: init.body && JSON.parse(init.body) });
    return new Response(
      JSON.stringify({ owner: { login: "yeseul" }, name: "coding-test" }),
      { status: 201 },
    );
  };

  const state = await createAndChooseRepo("  coding-test ");
  assert.equal(state.repo, "yeseul/coding-test");
  assert.deepEqual(store["dojang.github"].repo, { owner: "yeseul", name: "coding-test" });
  // 빈 저장소가 되지 않도록 README를 넣어 만듭니다.
  assert.deepEqual(sent, [
    {
      url: "https://api.github.com/user/repos",
      method: "POST",
      body: { name: "coding-test", auto_init: true },
    },
  ]);
  await assert.rejects(createAndChooseRepo("  "), /이름을 적어/);
});
