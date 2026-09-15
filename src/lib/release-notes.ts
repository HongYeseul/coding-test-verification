import manifest from "../../extension/manifest.json";

/**
 * 가장 최근 릴리스 하나씩입니다. 웹과 확장 프로그램 둘뿐입니다.
 *
 * 지난 것을 여기 쌓지 않습니다. 화면에 그리지 않을 값을 코드에 들고 있으면 새 릴리스를
 * 낼 때마다 어디까지 고쳐야 하는지가 흐려집니다. 지난 기록은 릴리스 페이지가 집니다.
 *
 * 확장 버전은 `extension/manifest.json`에서 직접 읽습니다. 손으로 옮겨 적으면
 * 릴리스를 낸 뒤 웹만 옛 번호를 가리키는 일이 생깁니다. 웹은 번호가 없어 배포한
 * 날짜로 가릅니다 — 계속 배포하는 쪽이라 번호를 붙여도 아무도 외우지 않습니다.
 */
export const EXTENSION_VERSION = manifest.version;

export const EXTENSION_DOWNLOAD_URL =
  "https://github.com/HongYeseul/coding-test-verification/releases/latest";

export const RELEASE_LIST_URL =
  "https://github.com/HongYeseul/coding-test-verification/releases";

export type Release = {
  /** 목록에서 어느 쪽 이야기인지 가르는 딱지입니다. */
  name: string;
  /** 배포한 날. `YYYY-MM-DD` */
  date: string;
  /** 이번에 무엇이 좋아졌는지 한 줄로. */
  summary: string;
  /** 바뀐 것. 한 줄에 하나씩. */
  highlights: string[];
  /** 확장만 받을 것이 있습니다. 웹은 이미 새 버전을 보고 있습니다. */
  downloadUrl?: string;
};

export const WEB_RELEASE: Release = {
  name: "웹",
  date: "2026-09-15",
  summary: "스터디에서 일어난 일을 디스코드 채널로 받습니다.",
  highlights: [
    "착석·퇴근·응원·검수를 디스코드 채널에 한 줄씩 보냅니다",
    "알림 문장을 누르면 그 그룹 화면이 바로 열립니다",
    "초대 링크를 넣어두면 멤버 화면에 참여 단추가 생깁니다",
  ],
};

export const EXTENSION_RELEASE: Release = {
  name: `크롬 확장 ${EXTENSION_VERSION}`,
  date: "2026-09-14",
  summary:
    "프로그래머스와 NeetCode에서 정답을 맞히면 방금 제출한 코드까지 함께 남길 수 있습니다.",
  highlights: [
    "프로그래머스에 이어 NeetCode가 추가됐습니다",
    "NeetCode 문제 링크를 인식합니다",
    "카드와 팝업 색을 디자인 시스템에 맞췄습니다",
  ],
  downloadUrl: EXTENSION_DOWNLOAD_URL,
};

export const RELEASES: Release[] = [WEB_RELEASE, EXTENSION_RELEASE];

/** 2026-09-15 → 2026.09.15 */
export function releaseDate(release: Release) {
  return release.date.replaceAll("-", ".");
}
