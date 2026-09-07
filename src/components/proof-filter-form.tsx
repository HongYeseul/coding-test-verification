"use client";

import { useRef, type ReactNode } from "react";

/** 선택을 바꾸면 바로 적용하고, 스크립트가 없으면 적용 버튼으로 제출합니다. */
export function ProofFilterForm({
  action,
  children,
}: {
  action: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement)
          formRef.current?.requestSubmit();
      }}
      className="flex flex-wrap items-center gap-2 py-[14px]"
    >
      {children}
    </form>
  );
}
