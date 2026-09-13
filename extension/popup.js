import { CONFIG } from "./config.js";
import { getSession, signIn, signOut, userIdFrom } from "./auth.js";
import { captureTab, problemUrlFromTab } from "./capture.js";

const LAST_GROUP_KEY = "dojang.lastGroup";
const view = {
  signin: document.getElementById("signin"),
  form: document.getElementById("form"),
  status: document.getElementById("status"),
  group: document.getElementById("group"),
  title: document.getElementById("title"),
  link: document.getElementById("link"),
  submit: document.getElementById("submit"),
};
let groups = [];
let tabUrl = "";

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
  view.title.placeholder = group?.is_coding_study
    ? "예: 프로그래머스 더 맵게"
    : "예: 6시 기상";
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
        problemUrl: problemUrl(),
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(result?.error ?? "기록을 남기지 못했습니다.");

    view.title.value = "";
    say(
      result.autoApproved
        ? "도장을 찍었습니다. 바로 인정됐습니다."
        : "도장을 찍었습니다. 검수 승인을 기다려주세요.",
    );
  } catch (error) {
    say(error instanceof Error ? error.message : "등록하지 못했습니다.", true);
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
}

view.group.addEventListener("change", () => {
  void chrome.storage.local.set({ [LAST_GROUP_KEY]: view.group.value });
  renderLink();
});
view.submit.addEventListener("click", submit);
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
  await signOut();
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
