import manifest from "../../extension/manifest.json";

/**
 * 대시보드에서 확장 프로그램을 안내할 때 쓰는 값입니다.
 *
 * 버전은 확장의 `manifest.json`에서 직접 읽습니다. 손으로 옮겨 적으면
 * 릴리스를 낸 뒤 웹만 옛 번호를 가리키는 일이 생깁니다.
 * 바뀐 내용은 릴리스 노트를 줄여 적습니다. 자세한 것은 릴리스 페이지에서 봅니다.
 */
export const EXTENSION_VERSION = manifest.version;

export const EXTENSION_RELEASE_URL =
  "https://github.com/HongYeseul/coding-test-verification/releases/latest";

/** 이번 버전에서 바뀐 것. 새 버전을 낼 때 RELEASE_NOTES.md와 함께 고칩니다. */
export const EXTENSION_HIGHLIGHTS = [
  "프로그래머스에 이어 NeetCode에서도 정답을 맞히면 카드가 뜹니다",
  "NeetCode 문제 링크를 인정합니다",
  "카드와 팝업이 종이 장부 색을 따라갑니다",
];
