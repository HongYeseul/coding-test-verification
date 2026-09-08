"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function InvitePopover({
  inviteUrl,
  children,
}: {
  inviteUrl?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function dismiss(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyMessage("초대 링크를 복사했습니다.");
    } catch {
      setCopyMessage("복사하지 못했습니다. 위 링크를 선택해 복사해주세요.");
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setCopyMessage("");
          setOpen(!open);
        }}
        className="btn"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21v-2a6 6 0 0 1 12 0v2M19 8v6m-3-3h6" />
        </svg>
        멤버 초대
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-canvas p-5 shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
      >
        <h3>멤버 초대</h3>
        <p className="mt-1 text-[13px] text-sub">
          링크나 코드를 공유하세요. 가입 신청 후 승인이 필요합니다.
        </p>
        {inviteUrl && (
          <div className="mt-4">
            <label
              className="text-[13px] text-sub"
              htmlFor={`${panelId}-url`}
            >
              초대 링크
            </label>
            <input
              id={`${panelId}-url`}
              value={inviteUrl}
              readOnly
              onFocus={(event) => event.target.select()}
              className="mt-1"
            />
            <button
              type="button"
              onClick={copyLink}
              className="btn btn-primary mt-2 w-full"
            >
              링크 복사
            </button>
            <p role="status" className="mt-2 text-[13px] text-sub">
              {copyMessage}
            </p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
