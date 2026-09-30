import { CONFIG } from "./config.js";
import { getSession, signIn } from "./auth.js";
import {
  chooseRepoByName,
  connectGithub,
  createAndChooseRepo,
  githubState,
  repoNames,
  uploadSolution,
  uploadTarget,
} from "./github.js";
import { injectIntoOpenTabs } from "./inject.js";
import { readable } from "./errors.js";

const LAST_GROUP_KEY = "dojang.lastGroup";

// 문제를 열어 둔 채 설치하거나 새 버전으로 바꿔도 그 탭에서 바로 카드가 뜨게 합니다.
chrome.runtime.onInstalled.addListener((details) => {
  void injectIntoOpenTabs(details);
});

/**
 * 콘텐츠 스크립트는 페이지 오리진에 묶여 있어 우리 서버로 바로 요청할 수 없습니다.
 * 등록은 이 서비스 워커가 대신합니다.
 *
 * 로그인과 스터디 선택도 여기서 처리합니다. 떠 있는 버튼만 눌러도 끝나야지,
 * "아이콘을 눌러 연결하세요"라고 안내만 하면 그 아이콘을 찾는 일이 숙제가 됩니다.
 * 크롬은 확장 아이콘을 퍼즐 메뉴에 숨겨 두기 때문에 더 그렇습니다.
 *
 * GitHub 저장소도 여기서 다룹니다. 카드의 저장소 줄이 연결·목록·고르기·만들기를 부탁하고,
 * 올리기는 도장이 찍힌 뒤 따로 부탁해 실패해도 도장은 남습니다. 토큰은 카드로 내보내지
 * 않습니다.
 *
 * 팝업의 로그인도 여기서 합니다. 팝업에서 로그인 창을 띄우면 로그인을 마친 창이 닫히며
 * 브라우저 창으로 포커스가 돌아올 때 팝업도 닫혀, 받은 코드를 토큰으로 바꿀 곳이 사라집니다.
 * 서비스 워커는 팝업보다 오래 삽니다.
 */
const TASKS = new Map([
  ["submit-code", { run: submit, fallback: "도장을 찍지 못했습니다." }],
  [
    "push-code",
    { run: uploadSolution, fallback: "저장소에 올리지 못했습니다." },
  ],
  [
    "sign-in",
    {
      // 토큰은 메시지에 싣지 않습니다. 팝업은 저장된 세션을 다시 읽습니다.
      run: () => signIn().then(() => ({ signedIn: true })),
      fallback: "GitHub 로그인을 마치지 못했습니다. 창을 닫았다면 다시 눌러주세요.",
    },
  ],
  [
    "connect-github",
    { run: connectGithub, fallback: "GitHub 연결을 마치지 못했습니다." },
  ],
  [
    "github-state",
    { run: githubState, fallback: "GitHub 연결 상태를 읽지 못했습니다." },
  ],
  [
    "list-repos",
    { run: repoNames, fallback: "저장소 목록을 불러오지 못했습니다." },
  ],
  [
    "choose-repo",
    {
      run: ({ repo }) => chooseRepoByName(repo),
      fallback: "저장소를 고르지 못했습니다.",
    },
  ],
  [
    "create-repo",
    {
      run: ({ name }) => createAndChooseRepo(name),
      fallback: "저장소를 만들지 못했습니다.",
    },
  ],
]);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const task = TASKS.get(message?.type);
  if (!task) return false;
  task.run(message).then(sendResponse, (error) =>
    sendResponse({
      error: readable(error, task.fallback),
      // 저장소 연결이 풀려 못 했으면 카드가 ‘GitHub 다시 연결’을 띄웁니다.
      ...(error?.reconnect ? { reconnect: true } : {}),
    }),
  );
  // 비동기로 답하므로 채널을 열어둡니다.
  return true;
});

async function loadGroups(session) {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/groups?select=id,name,is_coding_study&order=name`,
    {
      headers: {
        apikey: CONFIG.supabasePublishableKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  );
  if (!response.ok)
    throw new Error("스터디 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  // RLS가 활성 멤버인 그룹만 돌려줍니다.
  return response.json();
}

/**
 * 카드가 찍을 스터디를 정합니다. 하나뿐이면 묻지 않습니다.
 *
 * 카드는 풀이 코드를 남기므로 코딩 테스트 스터디에만 찍습니다. 팝업에서 마지막으로 고른
 * 스터디가 다른 종류면 그 값은 쓰지 않습니다 — 서버가 거절하는데 카드에서는 스터디를 바꿀
 * 길이 없어, 같은 오류만 되풀이됐습니다.
 */
async function resolveGroup(session, requestedGroupId) {
  const groups = (await loadGroups(session)).filter(
    (group) => group.is_coding_study,
  );
  const known = (id) => groups.some((group) => group.id === id);
  if (requestedGroupId && known(requestedGroupId)) {
    await chrome.storage.local.set({ [LAST_GROUP_KEY]: requestedGroupId });
    return { groupId: requestedGroupId };
  }
  const stored = (await chrome.storage.local.get(LAST_GROUP_KEY))[
    LAST_GROUP_KEY
  ];
  if (known(stored)) return { groupId: stored };

  if (groups.length === 0)
    return {
      error: "참여 중인 코딩 테스트 스터디가 없습니다. 웹에서 먼저 가입해주세요.",
    };
  if (groups.length === 1) {
    await chrome.storage.local.set({ [LAST_GROUP_KEY]: groups[0].id });
    return { groupId: groups[0].id };
  }
  // 여러 개면 화면에서 고르게 합니다.
  return { chooseGroup: groups.map(({ id, name }) => ({ id, name })) };
}

async function submit({ solutionCode, problemUrl, title, tags, groupId }) {
  // 로그인돼 있지 않으면 이 자리에서 바로 GitHub 창을 엽니다.
  let session = await getSession();
  if (!session) {
    try {
      session = await signIn();
    } catch (error) {
      return { error: readable(error, "GitHub 로그인을 마치지 못했습니다. 창을 닫았다면 다시 눌러주세요.") };
    }
  }

  const resolved = await resolveGroup(session, groupId);
  if (resolved.error || resolved.chooseGroup) return resolved;

  const response = await fetch(`${CONFIG.appUrl}/api/proofs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      groupId: resolved.groupId,
      evidencePath: "",
      // 응답이 유실돼 다시 눌러도 기록이 하나만 생기게 하는 열쇠입니다.
      recordKey: crypto.randomUUID(),
      title: title ?? "",
      problemUrl: problemUrl ?? "",
      solutionCode,
      tags: tags ?? "",
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) return { error: result?.error ?? "도장을 찍지 못했습니다." };
  return {
    autoApproved: Boolean(result.autoApproved),
    // 저장소를 골라 뒀으면 카드가 이어서 올립니다.
    repo: await uploadTarget(),
  };
}
