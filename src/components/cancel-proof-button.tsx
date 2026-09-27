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
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="text-[13px] text-danger underline disabled:cursor-wait"
      onClick={(event) => {
        // 되돌릴 수 없는 일이라 한 번 묻습니다. 사진 삭제를 마저 하는 다시 시도는 묻지 않습니다.
        if (retry) return;
        const question = hasPhoto
          ? "이 기록을 취소할까요? 올린 사진도 지워지고 되돌릴 수 없습니다."
          : "이 기록을 취소할까요? 되돌릴 수 없습니다.";
        if (!window.confirm(question)) event.preventDefault();
      }}
    >
      {pending ? "취소하는 중…" : retry ? "삭제 다시 시도" : "기록 취소"}
    </button>
  );
}
