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
      className="rounded-xl border border-[var(--line-strong)] px-3 py-2 text-sm font-bold text-[var(--muted-strong)] transition hover:bg-[var(--surface-subtle)] disabled:cursor-wait disabled:opacity-60"
    >
      {isPending ? "불러오는 중…" : "현황 새로고침"}
    </button>
  );
}
