import manifest from "../../extension/manifest.json";

/**
 * 대시보드에서 확장 프로그램 릴리스 노트를 보여줄 때 쓰는 값입니다.
 *
 * 버전은 확장의 `manifest.json`에서 직접 읽습니다. 손으로 옮겨 적으면
 * 릴리스를 낸 뒤 웹만 옛 번호를 가리키는 일이 생깁니다.
 */
export const EXTENSION_VERSION = manifest.version;

export const EXTENSION_RELEASE_URL =
  "https://github.com/HongYeseul/coding-test-verification/releases/latest";

/** 이번 버전에서 무엇이 좋아졌는지 한 줄로. */
export const EXTENSION_SUMMARY =
  "프로그래머스와 NeetCode에서 정답을 맞히면 방금 제출한 코드까지 함께 남길 수 있습니다.";

/** 바뀐 것. 한 줄에 하나씩, 새 버전을 낼 때 RELEASE_NOTES.md와 함께 고칩니다. */
export const EXTENSION_HIGHLIGHTS = [
  "프로그래머스에 이어 NeetCode가 추가됐습니다",
  "NeetCode 문제 링크를 인식합니다",
  "카드와 팝업 색을 디자인 시스템에 맞췄습니다",
];
