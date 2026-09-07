import Link from "next/link";
import type { ReactNode } from "react";

/** 모든 화면이 같은 상단바와 1024px 폭을 쓰도록 감싸는 껍데기입니다. */
export function AppShell({
  context,
  actions,
  children,
}: {
  context?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[1024px] px-3 py-4 sm:px-8 sm:py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-[17px] sm:mb-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-[26px] place-items-center rounded-md bg-brand-soft text-brand"
            >
              ✓
            </span>
            <span className="font-[650] tracking-[-0.4px]">Coding Proof</span>
          </Link>
          {context && (
            <span className="truncate text-xs text-sub">/ {context}</span>
          )}
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}
