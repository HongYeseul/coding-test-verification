"use client";

import { useSyncExternalStore } from "react";

import {
  applyTheme,
  isTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

const labels: Record<Theme, string> = {
  system: "시스템",
  light: "라이트",
  dark: "다크",
};

const nextTheme: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

/**
 * 아이콘은 SVG로 직접 그립니다.
 * ☀ ☾ 같은 글리프는 기기 폰트에 따라 굵기가 달라지거나 이모지로 바뀝니다.
 */
function ThemeIcon({ theme }: { theme: Theme }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      {theme === "light" && (
        <>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
      {theme === "dark" && (
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      )}
      {theme === "system" && (
        <>
          <circle cx="12" cy="12" r="8.5" />
          {/* 왼쪽 반원만 채워 자동임을 나타냅니다. */}
          <path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

/** 저장소는 React 밖의 상태라 구독으로 읽습니다. 다른 탭의 변경도 함께 따라옵니다. */
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : "system";
  } catch {
    // 저장소를 막아둔 브라우저에서는 시스템 설정을 그대로 씁니다.
    return "system";
  }
}

/** 서버에서는 사용자의 선택을 알 수 없으므로 시스템으로 그립니다. */
function serverTheme(): Theme {
  return "system";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const next = nextTheme[theme];
  const description = `화면 테마: ${labels[theme]}. 누르면 ${labels[next]}로 바꿉니다.`;

  function choose(value: Theme) {
    applyTheme(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // 저장에 실패해도 이번 방문 동안은 선택이 유지됩니다.
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={() => choose(next)}
      title={description}
      aria-label={description}
      className="grid size-9 place-items-center rounded-md text-sub hover:bg-soft"
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
