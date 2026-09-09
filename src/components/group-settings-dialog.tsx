"use client";

import { useEffect, useRef, useState } from "react";

import { updateGroupSettingsAction } from "@/app/actions/groups";

/** 자주 여는 화면이 아니라 본문에 두지 않고 헤더에서 모달로 엽니다. */
export function GroupSettingsDialog({
  groupId,
  groupSlug,
  autoApprove,
  isPublic,
}: {
  groupId: string;
  groupSlug: string;
  autoApprove: boolean;
  isPublic: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {/* 그룹 이름 옆에 놓이므로 글자 없이 아이콘만 씁니다. */}
      <button
        type="button"
        aria-label="그룹 설정"
        title="그룹 설정"
        onClick={() => setOpen(true)}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-sub hover:bg-soft hover:text-ink"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 8h8M18 8h2M4 16h2M12 16h8" />
          <circle cx="15" cy="8" r="2.4" />
          <circle cx="9" cy="16" r="2.4" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        aria-label="그룹 설정"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto max-h-[calc(100dvh-40px)] w-[min(520px,calc(100%-32px))] overflow-y-auto rounded-[14px] border border-line bg-canvas p-6 text-ink backdrop:bg-black/40"
      >
        {/* 취소하고 다시 열면 저장된 값으로 돌아오도록 폼을 다시 그립니다. */}
        <form
          key={open ? "open" : "closed"}
          action={updateGroupSettingsAction}
          onSubmit={() => setOpen(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <h3>그룹 설정</h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
          </div>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="groupSlug" value={groupSlug} />

          <div className="my-5 grid gap-5">
            <label className="flex items-start gap-2 text-[15px]">
              <input
                type="checkbox"
                name="autoApprove"
                defaultChecked={autoApprove}
                className="mt-1"
              />
              <span>
                자동 인정
                <span className="mt-1 block text-[13px] text-sub">
                  켜면 새 기록이 등록하는 순간 인정됩니다. 소유자와 검수자가
                  반려하면 미인정으로 내려갑니다. 이미 등록된 기록은 그대로
                  둡니다.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-[15px]">
              <input
                type="checkbox"
                name="isPublic"
                defaultChecked={isPublic}
                className="mt-1"
              />
              <span>
                공개 리더보드
                <span className="mt-1 block text-[13px] text-sub">
                  켜면 로그인하지 않은 사람도 멤버 닉네임과 승인 건수를 볼 수
                  있습니다. 사진·문제 링크·검수 내용은 공개되지 않습니다. 끄더라도
                  그룹 이름과 인원수는 첫 화면 목록에 나옵니다.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => setOpen(false)}
            >
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              저장
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
