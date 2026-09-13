"use client";

import { useFormStatus } from "react-dom";

/** 하트 윤곽. 응원한 상태에서는 채웁니다. */
export function HeartIcon({
  filled = false,
  className = "size-4",
}: {
  filled?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}

/** 응원 폼의 제출 버튼. 보내는 동안 두 번 눌리지 않게 잠급니다. */
export function CheerButton({ cheered }: { cheered: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={cheered}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${
        cheered
          ? "border-danger/40 bg-danger/10 text-danger"
          : "border-line bg-surface text-ink hover:bg-soft"
      }`}
    >
      <HeartIcon filled={cheered} />
      {cheered ? "응원함" : "응원"}
    </button>
  );
}
