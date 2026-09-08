export const THEME_STORAGE_KEY = "coding-proof-theme";

/** 같은 탭 안에서 선택이 바뀐 것을 알리는 이벤트입니다. storage 이벤트는 다른 탭에서만 옵니다. */
export const THEME_CHANGE_EVENT = "coding-proof-theme-change";

export const themes = ["system", "light", "dark"] as const;

export type Theme = (typeof themes)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.includes(value as Theme);
}

/** 저장한 테마를 문서에 적용합니다. 시스템을 고르면 속성을 지워 OS 설정을 따릅니다. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/**
 * 첫 페인트 전에 실행해 화면이 번쩍이지 않게 합니다.
 * layout에서 문자열 그대로 넣으므로 외부 참조 없이 혼자 동작해야 합니다.
 */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}})();`;
