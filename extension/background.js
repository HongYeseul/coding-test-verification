import { CONFIG } from "./config.js";
import { getSession, signIn } from "./auth.js";

const LAST_GROUP_KEY = "dojang.lastGroup";

/**
 * 콘텐츠 스크립트는 페이지 오리진에 묶여 있어 우리 서버로 바로 요청할 수 없습니다.
 * 등록은 이 서비스 워커가 대신합니다.
 *
 * 로그인과 스터디 선택도 여기서 처리합니다. 떠 있는 버튼만 눌러도 끝나야지,
 * "아이콘을 눌러 연결하세요"라고 안내만 하면 그 아이콘을 찾는 일이 숙제가 됩니다.
 * 크롬은 확장 아이콘을 퍼즐 메뉴에 숨겨 두기 때문에 더 그렇습니다.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "submit-code") return false;
  submit(message).then(sendResponse, (error) =>
    sendResponse({ error: error?.message ?? "등록하지 못했습니다." }),
  );
  // 비동기로 답하므로 채널을 열어둡니다.
  return true;
});

async function loadGroups(session) {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/rest/v1/groups?select=id,name&order=name`,
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

/** 고른 스터디가 없으면 정합니다. 하나뿐이면 묻지 않습니다. */
async function resolveGroup(session, requestedGroupId) {
  if (requestedGroupId) {
    await chrome.storage.local.set({ [LAST_GROUP_KEY]: requestedGroupId });
    return { groupId: requestedGroupId };
  }
  const stored = (await chrome.storage.local.get(LAST_GROUP_KEY))[
    LAST_GROUP_KEY
  ];
  if (stored) return { groupId: stored };

  const groups = await loadGroups(session);
  if (groups.length === 0)
    return { error: "참여 중인 스터디가 없습니다. 웹에서 먼저 가입해주세요." };
  if (groups.length === 1) {
    await chrome.storage.local.set({ [LAST_GROUP_KEY]: groups[0].id });
    return { groupId: groups[0].id };
  }
  // 여러 개면 화면에서 고르게 합니다.
  return { chooseGroup: groups };
}

async function submit({ solutionCode, problemUrl, title, tags, groupId }) {
  // 연결돼 있지 않으면 이 자리에서 바로 GitHub 창을 엽니다.
  let session = await getSession();
  if (!session) {
    try {
      session = await signIn();
    } catch (error) {
      return {
        error:
          error instanceof Error && error.message
            ? error.message
            : "GitHub 연결을 마치지 못했습니다.",
      };
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
  if (!response.ok) return { error: result?.error ?? "등록하지 못했습니다." };
  return { autoApproved: Boolean(result.autoApproved) };
}
