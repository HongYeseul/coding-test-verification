// 웹앱의 src/lib/compress-photo.ts와 같은 한도를 씁니다. 한쪽을 바꾸면 다른 쪽도 바꿉니다.
const EDGE_STEPS = [1440, 1200, 1024];
const QUALITIES = [0.86, 0.76, 0.66];
const TARGET_BYTES = 120 * 1024;
const MAX_BYTES = 300 * 1024;

/**
 * 지금 보이는 탭 화면을 그대로 찍습니다.
 * 페이지의 DOM이나 네트워크 응답은 읽지 않습니다. 사용자가 캡처 버튼을 눌러
 * 스크린샷을 찍는 것과 같은 동작이며, activeTab 권한만 필요합니다.
 */
export async function captureTab() {
  const dataUrl = await chrome.tabs.captureVisibleTab({ format: "png" });
  const source = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(source);
  try {
    return await compress(bitmap);
  } finally {
    bitmap.close();
  }
}

async function compress(bitmap) {
  const longest = Math.max(bitmap.width, bitmap.height);
  let smallest = null;
  let previousEdge = 0;

  for (const maxEdge of EDGE_STEPS) {
    const edge = Math.min(maxEdge, longest);
    if (edge === previousEdge) continue;
    previousEdge = edge;
    const scale = edge / longest;
    const canvas = new OffscreenCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서는 화면을 처리할 수 없습니다.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    // 투명한 캡처도 밝은 배경에서 읽히도록 합성합니다.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const candidate = await canvas.convertToBlob({
        type: "image/webp",
        quality,
      });
      if (candidate.type !== "image/webp" || candidate.size < 1)
        throw new Error("이 브라우저에서는 화면을 압축할 수 없습니다.");
      if (!smallest || candidate.size < smallest.size) smallest = candidate;
      if (smallest.size <= TARGET_BYTES) return smallest;
    }
  }

  if (!smallest || smallest.size > MAX_BYTES)
    throw new Error(
      "압축 후에도 300KB를 넘습니다. 창을 줄이거나 필요한 부분만 보이게 하고 다시 눌러주세요.",
    );
  return smallest;
}

// 웹앱의 src/lib/proof-input.ts와 같은 목록입니다. 문제 링크를 자동으로 채울 때만 씁니다.
const PROBLEM_HOSTS = [
  "programmers.co.kr",
  "school.programmers.co.kr",
  "acmicpc.net",
  "leetcode.com",
  "codeforces.com",
  "atcoder.jp",
  "hackerrank.com",
  "codewars.com",
];

/** 탭 주소가 지원 플랫폼이면 저장 형식에 맞춰 다듬어 돌려줍니다. */
export function problemUrlFromTab(tabUrl) {
  if (!tabUrl) return "";
  let parsed;
  try {
    parsed = new URL(tabUrl);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:") return "";
  const host = parsed.hostname.replace(/^www\./, "");
  if (!PROBLEM_HOSTS.includes(host)) return "";
  const path = parsed.pathname.replace(/\/+$/, "");
  const url = `https://${host}${path}`;
  return url.length <= 500 ? url : "";
}
