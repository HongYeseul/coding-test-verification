"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshOverviewButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="text-[13px] text-sub underline disabled:cursor-wait"
    >
      {isPending ? "불러오는 중…" : "새로고침"}
    </button>
  );
}
