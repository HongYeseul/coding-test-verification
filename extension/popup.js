import { CONFIG } from "./config.js";
import { getSession, signIn, signOut, userIdFrom } from "./auth.js";
import { captureTab, problemUrlFromTab } from "./capture.js";
import { disconnectGithub, getGithub, repoName, repoUrl } from "./github.js";
import { readable } from "./errors.js";

const LAST_GROUP_KEY = "dojang.lastGroup";
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
  repoLink: document.getElementById("repo-link"),
  repoState: document.getElementById("repo-state"),
  repoDisconnect: document.getElementById("repo-disconnect"),
  signout: document.getElementById("signout"),
};
let groups = [];
let tabUrl = "";

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
    `${CONFIG.supabaseUrl}/rest/v1/groups?select=id,name,slug,requires_photo,is_coding_study,record_kind&order=name`,
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
  if (!userId) throw new Error("로그인 정보를 읽지 못했습니다. 다시 로그인해주세요.");
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
  if (!response.ok) throw new Error("사진을 올리지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.");
  return path;
}

async function submit() {
  const group = selectedGroup();
  if (!group) return;
  // 착석 스터디는 착석·퇴근 두 번 찍어 시간을 잽니다. 팝업에는 그 칸이 없어, 보내 봐야
  // 서버가 거절하고 할 수 있는 일도 없습니다. 먼저 알려 줍니다.
  if (group.record_kind === "DURATION")
    return say("착석 스터디는 웹에서 착석·퇴근 도장을 찍어주세요.", true);
  view.submit.disabled = true;
  try {
    const session = await getSession();
    if (!session) return showSignIn();

    say("화면을 찍는 중…");
    const photo = await captureTab();

    say(`사진 올리는 중… ${Math.round(photo.size / 1024)}KB`);
    const evidencePath = await uploadPhoto(session, group.id, photo);

    say("도장 찍는 중…");
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
    say(readable(error, "도장을 찍지 못했습니다. 잠시 후 다시 시도해주세요."), true);
  } finally {
    view.submit.disabled = false;
  }
}

function showSignIn() {
  view.signin.hidden = false;
  view.form.hidden = true;
  view.signout.hidden = true;
}

async function showForm(session) {
  groups = await loadGroups(session);
  view.signout.hidden = false;
  if (groups.length === 0) {
    view.signin.hidden = true;
    view.form.hidden = true;
    return say(
      "참여 중인 스터디가 없습니다. 웹에서 먼저 가입하거나 다른 계정으로 로그인해주세요.",
      true,
    );
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
 * GitHub 저장소는 한 줄만 보여 줍니다. 연결하고 고르는 일은 정답 카드에서 합니다 — 그 순간이
 * 이 기능을 처음 알게 되는 자리라서입니다. 여기는 어디에 올리고 있는지 보고 끄는 곳이라,
 * 연결한 적이 없으면 줄을 숨깁니다.
 */
async function renderRepo() {
  const github = await getGithub();
  view.repo.hidden = !github;
  if (!github) return;
  // 연결이 풀렸으면 저장소 이름 대신 그 사실만 적습니다. 다시 연결은 정답 카드에서 합니다.
  const showRepo = Boolean(github.token && github.repo);
  view.repoLink.hidden = !showRepo;
  if (showRepo) {
    view.repoLink.textContent = repoName(github.repo);
    // 이름이 길면 줄여 보이므로 마우스를 올리면 전체를 보여 줍니다.
    view.repoLink.title = repoName(github.repo);
    view.repoLink.href = repoUrl(github.repo);
  }
  view.repoState.textContent = !github.token
    ? "연결 풀림"
    : showRepo
      ? ""
      : "고르기 전";
}

view.group.addEventListener("change", () => {
  void chrome.storage.local.set({ [LAST_GROUP_KEY]: view.group.value });
  renderLink();
});
view.submit.addEventListener("click", submit);

view.repoDisconnect.addEventListener("click", async () => {
  await disconnectGithub();
  await renderRepo();
  say("저장소 연결을 끊었습니다. 다음 정답 카드에서 다시 연결할 수 있습니다.");
});
document.getElementById("signin-button").addEventListener("click", async () => {
  try {
    say("GitHub 로그인 창을 여는 중…");
    await signIn();
    say("");
    await showForm(await getSession());
  } catch (error) {
    say(
      readable(error, "GitHub 로그인을 마치지 못했습니다. 창을 닫았다면 다시 눌러주세요."),
      true,
    );
  }
});
document.getElementById("signout").addEventListener("click", async () => {
  // 저장소 토큰도 같은 로그인으로 받은 것이라 함께 버립니다.
  await signOut();
  await disconnectGithub();
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
    say(readable(error, "불러오지 못했습니다. 잠시 후 다시 시도해주세요."), true);
  }
})();
