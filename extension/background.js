import { CONFIG } from "./config.js";
import { getSession } from "./auth.js";

const LAST_GROUP_KEY = "dojang.lastGroup";

/**
 * 콘텐츠 스크립트는 페이지 오리진에 묶여 있어 우리 서버로 바로 요청할 수 없습니다.
 * 등록은 이 서비스 워커가 대신합니다.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "submit-code") return false;
  submit(message).then(sendResponse, (error) =>
    sendResponse({ error: error?.message ?? "등록하지 못했습니다." }),
  );
  // 비동기로 답하므로 채널을 열어둡니다.
  return true;
});

async function submit({ solutionCode, problemUrl, title }) {
  const session = await getSession();
  if (!session)
    return { error: "먼저 도장 아이콘을 눌러 GitHub로 연결해주세요." };

  const groupId = (await chrome.storage.local.get(LAST_GROUP_KEY))[
    LAST_GROUP_KEY
  ];
  if (!groupId)
    return { error: "도장 아이콘을 눌러 어느 스터디에 남길지 먼저 골라주세요." };

  const response = await fetch(`${CONFIG.appUrl}/api/proofs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      groupId,
      evidencePath: "",
      // 응답이 유실돼 다시 눌러도 기록이 하나만 생기게 하는 열쇠입니다.
      recordKey: crypto.randomUUID(),
      title: title ?? "",
      problemUrl: problemUrl ?? "",
      solutionCode,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    return { error: result?.error ?? "등록하지 못했습니다." };
  return { autoApproved: Boolean(result.autoApproved) };
}
