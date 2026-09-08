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

const symbols: Record<Theme, string> = {
  system: "◐",
  light: "☀",
  dark: "☾",
};

const nextTheme: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

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
      aria-label={`화면 테마: ${labels[theme]}. 누르면 ${labels[next]}로 바꿉니다.`}
      className="flex items-center gap-1 text-[13px] text-sub"
    >
      <span aria-hidden="true">{symbols[theme]}</span>
      <span aria-hidden="true">{labels[theme]}</span>
    </button>
  );
}
