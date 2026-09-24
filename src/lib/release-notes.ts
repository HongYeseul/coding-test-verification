import manifest from "../../extension/manifest.json";

/**
 * 웹과 크롬 확장의 릴리스 기록입니다.
 *
 * 카드는 면마다 최신 하나씩만 보여주고, 전부는 `/releases`가 집니다. 지난 기록을
 * GitHub 릴리스로 보내면 거기엔 확장 이야기밖에 없어 웹이 소식 없는 제품처럼 보입니다.
 *
 * 확장 버전은 `extension/manifest.json`에서 직접 읽습니다. 손으로 옮겨 적으면
 * 릴리스를 낸 뒤 웹만 옛 번호를 가리키는 일이 생깁니다. 웹은 번호가 없어 배포한
 * 날짜로 가릅니다 — 계속 배포하는 쪽이라 번호를 붙여도 아무도 외우지 않습니다.
 */
export const EXTENSION_VERSION = manifest.version;

export const EXTENSION_DOWNLOAD_URL =
  "https://github.com/HongYeseul/coding-test-verification/releases/latest";

export const GITHUB_RELEASE_URL =
  "https://github.com/HongYeseul/coding-test-verification/releases";

export type ReleaseSurface = "WEB" | "EXTENSION";

export type Release = {
  surface: ReleaseSurface;
  /**
   * 확장의 지난 버전에만 적습니다. 가장 최근 것은 비워 두어야 manifest를 따라갑니다 —
   * 적어 두면 릴리스를 낸 뒤 여기만 옛 번호로 남습니다.
   */
  version?: string;
  /** 배포한 날. `YYYY-MM-DD` */
  date: string;
  /** 이번에 무엇이 좋아졌는지 한 줄로. */
  summary: string;
  /** 바뀐 것. 한 줄에 하나씩. */
  highlights: string[];
};

/** 최신이 위로 옵니다. 새 배포를 낼 때 맨 앞에 더합니다. */
export const RELEASES: Release[] = [
  {
    surface: "EXTENSION",
    date: "2026-09-24",
    summary: "도장을 찍으면 풀이를 내 GitHub 저장소에도 올릴 수 있습니다.",
    highlights: [
      "팝업에서 GitHub 저장소를 연결하고 올릴 저장소를 고르거나 새로 만듭니다",
      "카드로 도장을 찍으면 코드와 문제 정보가 그 저장소에 커밋 하나로 올라갑니다",
      "문제 설명은 올리지 않고 제목·링크·태그만 적습니다",
      "공개 저장소만 고를 수 있고, 연결하지 않으면 지금과 같습니다",
    ],
  },
  {
    surface: "EXTENSION",
    version: "0.2.7",
    date: "2026-09-23",
    summary: "문제를 열어 둔 채 확장을 설치하거나 바꿔도 바로 도장을 찍을 수 있습니다.",
    highlights: [
      "설치하거나 새 버전으로 바꿀 때 열려 있던 문제 탭에서도 정답 카드가 뜹니다",
      "확장을 바꾸기 전에 뜬 카드에서 도장 찍기가 멈추던 문제를 고쳤습니다",
    ],
  },
  {
    surface: "WEB",
    date: "2026-09-15",
    summary: "스터디에서 일어난 일을 디스코드로 받을 수 있습니다.",
    highlights: [
      "착석·퇴근·응원·검수가 있을 때마다 디스코드 채널로 알림을 받을 수 있습니다",
      "알림을 누르면 그 스터디 화면이 바로 열립니다",
      "방장이 초대 링크를 넣어두면 멤버 화면에 디스코드 참여 버튼이 생깁니다",
      "오늘 도장 현황과 문제 목록을 보기 편하게 정리했습니다",
    ],
  },
  {
    surface: "WEB",
    date: "2026-09-14",
    summary: "코딩 테스트가 아닌 스터디도 쓸 수 있게 됐습니다.",
    highlights: [
      "기상 스터디는 몇 시에 찍었는지, 착석 스터디는 얼마나 앉아 있었는지 함께 남습니다",
      "착석 스터디는 앉을 때와 일어날 때 도장을 한 번씩 찍습니다",
      "목표는 멤버마다 따로 정하고, 한 주 기록을 차트로 봅니다",
      "남의 기록에 응원을 남길 수 있습니다",
      "오늘 누가 찍었는지 스터디 화면 맨 위에서 바로 봅니다",
      "화면 전체를 종이 장부처럼 다시 그렸습니다",
    ],
  },
  {
    surface: "EXTENSION",
    version: "0.2.6",
    date: "2026-09-14",
    summary:
      "프로그래머스와 NeetCode에서 정답을 맞히면 방금 제출한 코드까지 남길 수 있습니다.",
    highlights: [
      "프로그래머스에 이어 NeetCode가 추가됐습니다",
      "NeetCode 문제 링크도 인식합니다",
      "카드와 팝업 색을 웹 화면과 맞췄습니다",
    ],
  },
  {
    surface: "WEB",
    date: "2026-09-13",
    summary: "화면 곳곳의 말을 하나로 맞췄습니다.",
    highlights: [
      "기록을 남기는 행동은 어디서나 ‘도장 찍기’로 부릅니다",
      "이름이 바뀐 뒤에도 옛 이름이 남아 있던 아홉 곳을 고쳤습니다",
    ],
  },
];

export const surfaceLabels: Record<ReleaseSurface, string> = {
  WEB: "웹",
  EXTENSION: "크롬 확장",
};

/** 목록에 붙일 이름입니다. 확장은 번호가 있어야 어느 것을 받았는지 압니다. */
export function releaseName(release: Release) {
  if (release.surface === "EXTENSION") {
    return `${surfaceLabels.EXTENSION} ${release.version ?? EXTENSION_VERSION}`;
  }
  return surfaceLabels.WEB;
}

/** 면마다 가장 최근 것 하나씩. 카드가 쓰는 값입니다. */
export function latestReleases() {
  return (["WEB", "EXTENSION"] as const)
    .map((surface) => RELEASES.find((release) => release.surface === surface))
    .filter((release): release is Release => release !== undefined);
}

/** 받을 것이 있는 확장 릴리스인지. 지난 버전에는 받기 단추를 달지 않습니다. */
export function isLatestExtension(release: Release) {
  return release.surface === "EXTENSION" && !release.version;
}

/** 2026-09-15 → 2026.09.15 */
export function releaseDate(release: Release) {
  return release.date.replaceAll("-", ".");
}
