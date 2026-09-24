import { CONFIG } from "./config.js";
import { getSession, signIn, signOut, userIdFrom } from "./auth.js";
import { captureTab, problemUrlFromTab } from "./capture.js";
import {
  chooseRepo,
  createRepo,
  disconnectGithub,
  getGithub,
  listRepos,
  repoName,
} from "./github.js";

const LAST_GROUP_KEY = "dojang.lastGroup";
// 저장소 목록 끝에 두는 '새 저장소 만들기'의 값입니다. 저장소 이름에는 '/'가 들어가 겹치지 않습니다.
const NEW_REPO = "new";
const view = {
  signin: document.getElementById("signin"),
  form: document.getElementById("form"),
  status: document.getElementById("status"),
  group: document.getElementById("group"),
  title: document.getElementById("title"),
  titleLabel: document.getElementById("title-label"),
  tags: document.getElementById("tags"),
  link: document.getElementById("link"),
  submit: document.getElementById("submit"),
  repo: document.getElementById("repo"),
  repoState: document.getElementById("repo-state"),
  repoOff: document.getElementById("repo-off"),
  repoOn: document.getElementById("repo-on"),
  repoConnect: document.getElementById("repo-connect"),
  repoSelect: document.getElementById("repo-select"),
  repoCreate: document.getElementById("repo-create"),
  repoNewName: document.getElementById("repo-new-name"),
  repoCreateButton: document.getElementById("repo-create-button"),
  repoDisconnect: document.getElementById("repo-disconnect"),
};
let groups = [];
let tabUrl = "";
// 고를 수 있는 저장소 목록입니다. 팝업이 열려 있는 동안 한 번만 가져옵니다.
let repoList = null;

// 머리말 도장. 도형은 seal.js 한 벌에서 오고 색은 popup.css의 .seal이 정합니다.
document.getElementById("seal").append(window.dojangSeal({ size: 26 }));

function say(message, isError = false) {
  view.status.textContent = message;
  view.status.classList.toggle("error", isError);
}

function selectedGroup() {
  return groups.find((group) => group.id === view.group.value) ?? null;
}

/** 코딩 스터디이고 탭이 지원 플랫폼일 때만 문제 링크를 함께 보냅니다. */
function problemUrl() {
  const group = selectedGroup();
  return group?.is_coding_study ? problemUrlFromTab(tabUrl) : "";
}

function renderLink() {
  const url = problemUrl();
  view.link.hidden = !url;
  view.link.textContent = url ? `문제 링크: ${url}` : "";
  const group = selectedGroup();
  // 화면의 등록 창과 같은 말을 씁니다.
  view.titleLabel.childNodes[0].nodeValue = group?.is_coding_study
    ? "문제 제목 "
    : "한 줄 메모 ";
  view.title.placeholder = group?.is_coding_study ? "예: 더 맵게" : "예: 6시 기상";
  view.tags.placeholder = group?.is_coding_study
    ? "예: 해시, 정렬"
    : "예: 새벽, 러닝";
}

async function loadGroups(session) {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/groups?select=id,name,slug,requires_photo,is_coding_study&order=name`,
    {
      headers: {
        apikey: CONFIG.supabasePublishableKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
    },
  );
  if (!response.ok) throw new Error("스터디 목록을 불러오지 못했습니다.");
  // RLS가 활성 멤버인 그룹만 돌려줍니다.
  return response.json();
}

async function uploadPhoto(session, groupId, blob) {
  const userId = userIdFrom(session.accessToken);
  if (!userId) throw new Error("로그인 정보를 읽지 못했습니다. 다시 연결해주세요.");
  // 웹앱과 같은 경로 계약입니다: <group-id>/<user-id>/<file-id>.webp
  const path = `${groupId}/${userId}/${crypto.randomUUID()}.webp`;
  const response = await fetch(
    `${CONFIG.supabaseUrl}/storage/v1/object/proof-evidence/${path}`,
    {
      method: "POST",
      headers: {
        apikey: CONFIG.supabasePublishableKey,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "image/webp",
        "x-upsert": "false",
      },
      body: blob,
    },
  );
  if (!response.ok) throw new Error("사진을 올리지 못했습니다.");
  return path;
}

async function submit() {
  const group = selectedGroup();
  if (!group) return;
  view.submit.disabled = true;
  try {
    const session = await getSession();
    if (!session) return showSignIn();

    say("화면을 찍고 있습니다…");
    const photo = await captureTab();

    say(`사진 올리는 중 (${Math.round(photo.size / 1024)}KB)…`);
    const evidencePath = await uploadPhoto(session, group.id, photo);

    say("기록을 남기는 중…");
    const response = await fetch(`${CONFIG.appUrl}/api/proofs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupId: group.id,
        evidencePath,
        recordKey: "",
        title: view.title.value,
        tags: view.tags.value,
        problemUrl: problemUrl(),
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(result?.error ?? "도장을 찍지 못했습니다.");

    view.title.value = "";
    say(
      result.autoApproved
        ? "도장을 찍었습니다. 바로 인정됐습니다."
        : "도장을 찍었습니다. 검수를 기다려주세요.",
    );
  } catch (error) {
    say(error instanceof Error ? error.message : "도장을 찍지 못했습니다.", true);
  } finally {
    view.submit.disabled = false;
  }
}

function showSignIn() {
  view.signin.hidden = false;
  view.form.hidden = true;
}

async function showForm(session) {
  groups = await loadGroups(session);
  if (groups.length === 0) {
    view.signin.hidden = true;
    view.form.hidden = true;
    return say("참여 중인 스터디가 없습니다. 웹에서 먼저 가입해주세요.", true);
  }
  const last = (await chrome.storage.local.get(LAST_GROUP_KEY))[LAST_GROUP_KEY];
  view.group.replaceChildren(
    ...groups.map((group) => new Option(group.name, group.id)),
  );
  if (groups.some((group) => group.id === last)) view.group.value = last;
  view.signin.hidden = true;
  view.form.hidden = false;
  renderLink();
  await renderRepo();
}

/**
 * GitHub 저장소 칸을 저장된 상태에 맞춥니다. 연결은 background가 하므로 팝업이 닫힌
 * 사이에 끝났을 수 있어, 열 때마다 저장된 값을 다시 읽습니다.
 */
async function renderRepo() {
  const github = await getGithub();
  const connected = Boolean(github?.token);
  view.repoOff.hidden = connected;
  view.repoOn.hidden = !connected;
  view.repoState.textContent = connected
    ? github.repo
      ? repoName(github.repo)
      : "고르기 전"
    : github?.repo
      ? "다시 연결해주세요"
      : "연결 안 됨";
  // 연결만 하고 고르지 않았으면 열어 둡니다. 고르는 칸을 찾아다니지 않게 합니다.
  if (connected && !github.repo) view.repo.open = true;
  if (connected && view.repo.open) await fillRepos(github);
}

/** 고를 수 있는 저장소를 채웁니다. 목록은 펼쳤을 때 처음 한 번만 가져옵니다. */
async function fillRepos(github) {
  const current = github.repo ? repoName(github.repo) : "";
  if (!repoList) {
    view.repoSelect.disabled = true;
    view.repoSelect.replaceChildren(new Option("저장소를 불러오는 중…", ""));
  }
  repoList ??= listRepos();
  let names;
  try {
    names = (await repoList).map(repoName);
  } catch (error) {
    repoList = null;
    view.repoSelect.replaceChildren(new Option("불러오지 못했습니다", ""));
    say(
      error instanceof Error ? error.message : "저장소 목록을 불러오지 못했습니다.",
      true,
    );
    // 토큰이 거절됐으면 연결하는 칸으로 돌아갑니다.
    if (!(await getGithub())?.token) await renderRepo();
    return;
  }
  // 목록 100개 밖의 저장소를 골라 뒀어도 지금 값은 보이게 합니다.
  if (current && !names.includes(current)) names.unshift(current);
  view.repoSelect.replaceChildren(
    ...(current ? [] : [new Option("고르기", "")]),
    ...names.map((name) => new Option(name, name)),
    new Option("새 저장소 만들기…", NEW_REPO),
  );
  view.repoSelect.value = current;
  view.repoSelect.disabled = false;
}

view.group.addEventListener("change", () => {
  void chrome.storage.local.set({ [LAST_GROUP_KEY]: view.group.value });
  renderLink();
});
view.submit.addEventListener("click", submit);

view.repo.addEventListener("toggle", () => {
  if (view.repo.open) void renderRepo();
});
view.repoConnect.addEventListener("click", async () => {
  view.repoConnect.disabled = true;
  say("GitHub 창에서 권한을 허용해주세요…");
  // 로그인 창은 background가 띄웁니다. 창이 뜨며 팝업이 닫혀도 연결은 끝까지 가고,
  // 다시 열면 저장소를 고르는 칸이 열려 있습니다.
  const result = await chrome.runtime
    .sendMessage({ type: "connect-github" })
    .catch(() => null);
  view.repoConnect.disabled = false;
  if (!result || result.error)
    return say(result?.error ?? "GitHub 연결을 마치지 못했습니다.", true);
  repoList = null;
  // 권한을 더 받으며 도장 로그인도 새로 했습니다. 다른 계정으로 들어왔을 수 있어 다시 그립니다.
  await showForm(await getSession());
  say(
    result.repo
      ? `@${result.login} 계정을 다시 연결했습니다. 풀이는 전처럼 ${result.repo} 저장소에 올라갑니다.`
      : `@${result.login} 계정을 연결했습니다. 올릴 저장소를 골라주세요.`,
  );
});
view.repoSelect.addEventListener("change", async () => {
  const value = view.repoSelect.value;
  view.repoCreate.hidden = value !== NEW_REPO;
  if (value === NEW_REPO) return view.repoNewName.focus();
  if (!value) return;
  const [owner, name] = value.split("/");
  await chooseRepo({ owner, name });
  view.repoState.textContent = value;
  say(`이제 카드로 찍은 풀이가 ${value} 저장소에 올라갑니다.`);
});
view.repoCreateButton.addEventListener("click", async () => {
  const name = view.repoNewName.value.trim();
  if (!name) return say("새 저장소 이름을 적어주세요.", true);
  view.repoCreateButton.disabled = true;
  say("저장소를 만드는 중…");
  try {
    const repo = await createRepo(name);
    await chooseRepo(repo);
    view.repoNewName.value = "";
    view.repoCreate.hidden = true;
    repoList = null;
    await renderRepo();
    say(
      `${repoName(repo)} 저장소를 만들었습니다. 카드로 찍은 풀이가 여기에 올라갑니다.`,
    );
  } catch (error) {
    say(error instanceof Error ? error.message : "저장소를 만들지 못했습니다.", true);
  } finally {
    view.repoCreateButton.disabled = false;
  }
});
view.repoDisconnect.addEventListener("click", async () => {
  await disconnectGithub();
  repoList = null;
  view.repoCreate.hidden = true;
  await renderRepo();
  say("저장소 연결을 끊었습니다.");
});
document.getElementById("signin-button").addEventListener("click", async () => {
  try {
    say("GitHub 로그인 창을 여는 중…");
    await signIn();
    say("");
    await showForm(await getSession());
  } catch (error) {
    say(error instanceof Error ? error.message : "연결하지 못했습니다.", true);
  }
});
document.getElementById("signout").addEventListener("click", async () => {
  // 저장소 토큰도 같은 로그인으로 받은 것이라 함께 버립니다.
  await signOut();
  await disconnectGithub();
  repoList = null;
  say("");
  showSignIn();
});

(async function start() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabUrl = tab?.url ?? "";
  const session = await getSession();
  if (!session) return showSignIn();
  try {
    await showForm(session);
  } catch (error) {
    say(error instanceof Error ? error.message : "불러오지 못했습니다.", true);
  }
})();
