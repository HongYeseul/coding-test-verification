"use client";

import { useLinkStatus } from "next/link";

/**
 * 링크가 이동 중일 때만 보이는 표시입니다.
 * 그룹 화면은 loading.tsx 없이 이전 화면을 유지하므로 여기서 진행 중임을 알립니다.
 */
export function LinkPendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center rounded-md bg-soft motion-safe:animate-pulse"
    />
  );
}
