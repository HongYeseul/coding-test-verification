"use client";

import { useFormStatus } from "react-dom";

export function CancelProofButton({
  retry,
  hasPhoto,
}: {
  retry: boolean;
  hasPhoto: boolean;
}) {
  const { pending } = useFormStatus();
  // 사진이 없는 기록은 지울 사진도 없으므로 문구에서 뺍니다.
  const target = hasPhoto ? "사진과 기록" : "기록";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-[13px] text-danger underline disabled:cursor-wait"
    >
      {pending
        ? `${target} 삭제 중…`
        : retry
          ? "삭제 다시 시도"
          : `검수 취소 · ${target} 삭제`}
    </button>
  );
}
