"use client";

import { useFormStatus } from "react-dom";

export function CancelProofButton({ retry }: { retry: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-[13px] text-danger underline disabled:cursor-wait"
    >
      {pending
        ? "사진과 기록 삭제 중…"
        : retry
          ? "삭제 다시 시도"
          : "검수 취소 · 사진과 기록 삭제"}
    </button>
  );
}
