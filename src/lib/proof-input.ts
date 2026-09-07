export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// proof-evidence 버킷의 file_size_limit과 함께 변경합니다.
export const MAX_PHOTO_BYTES = 300 * 1024;
export const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
export const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function normalizeInviteCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{5}$/.test(code) ? code : null;
}

export function isPhotoPath(path: string, groupId: string, userId: string) {
  const prefix = `${groupId}/${userId}/`;
  return (
    path.startsWith(prefix) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(
      path.slice(prefix.length),
    )
  );
}

export function photoError(
  file: { type: string; size: number },
  maxBytes = MAX_PHOTO_BYTES,
) {
  if (!Object.hasOwn(PHOTO_EXTENSIONS, file.type))
    return "JPG, PNG, WebP 사진만 올릴 수 있습니다.";
  if (!Number.isFinite(file.size) || file.size < 1 || file.size > maxBytes)
    return `사진은 ${maxBytes < 1024 * 1024 ? `${maxBytes / 1024}KB` : `${maxBytes / 1024 / 1024}MB`} 이하로 올려주세요.`;
  return null;
}

export const MAX_PROBLEM_URL_LENGTH = 500;
export const PROBLEM_URL_ERROR =
  "문제 링크는 프로그래머스·백준·LeetCode 등 지원 플랫폼의 https 주소만 넣을 수 있습니다.";

// 문제 링크로 허용하는 코딩 플랫폼입니다. 호스트를 추가할 때 라벨도 함께 적습니다.
const PROBLEM_PLATFORMS: Record<string, string> = {
  "programmers.co.kr": "프로그래머스",
  "school.programmers.co.kr": "프로그래머스",
  "acmicpc.net": "백준",
  "leetcode.com": "LeetCode",
  "codeforces.com": "Codeforces",
  "atcoder.jp": "AtCoder",
  "hackerrank.com": "HackerRank",
  "codewars.com": "Codewars",
};

export type ProblemLink = { url: string; platform: string };

/**
 * 허용한 플랫폼의 https 문제 링크만 통과시키고 같은 문제가 하나로 모이도록 정리합니다.
 * 호스트는 `www.`만 떼고 정확히 비교해 비슷한 이름의 다른 도메인을 막습니다.
 */
export function problemLink(value: string | null | undefined): ProblemLink | null {
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.replace(/^www\./, "");
  // `constructor` 같은 호스트가 Object 프로토타입 값을 통과시키지 않게 확인합니다.
  if (!Object.hasOwn(PROBLEM_PLATFORMS, host)) return null;
  const platform = PROBLEM_PLATFORMS[host];
  // 언어 선택·추적 파라미터와 끝 슬래시를 지워 같은 문제를 같은 링크로 만듭니다.
  const path = parsed.pathname.replace(/\/+$/, "");
  const url = `https://${host}${path}`;
  return url.length <= MAX_PROBLEM_URL_LENGTH ? { url, platform } : null;
}
