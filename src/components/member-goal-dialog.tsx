"use client";

import { useEffect, useRef, useState } from "react";

import { setMemberGoalAction } from "@/app/actions/groups";
import { formatClock, goalLabels, type RecordKind } from "@/lib/record-goal";

/**
 * 내 목표를 정하는 작은 다이얼로그입니다. 도장판의 내 이름 옆에서 엽니다.
 * 목표는 멤버마다 다르므로 그룹 설정이 아니라 여기에 둡니다.
 */
export function MemberGoalDialog({
  groupId,
  groupSlug,
  recordKind,
  goalMinutes,
}: {
  groupId: string;
  groupSlug: string;
  recordKind: Exclude<RecordKind, "NONE">;
  goalMinutes: number | null;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const label = goalMinutes === null ? "목표 정하기" : "바꾸기";

  return (
    <>
      <button
        type="button"
        aria-label={`${goalLabels[recordKind]} ${goalMinutes === null ? "정하기" : "바꾸기"}`}
        onClick={() => setOpen(true)}
        className="shrink-0 text-[12px] font-normal text-sub underline"
      >
        {label}
      </button>

      <dialog
        ref={dialogRef}
        aria-label={goalLabels[recordKind]}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false);
        }}
        className="m-auto w-[min(360px,calc(100%-32px))] rounded-surface border border-line bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        {/* 취소하고 다시 열면 저장된 값으로 돌아오도록 폼을 다시 그립니다. */}
        <form
          key={open ? "open" : "closed"}
          action={setMemberGoalAction}
          onSubmit={() => setOpen(false)}
        >
          <h2>{goalLabels[recordKind]}</h2>
          <input type="hidden" name="groupId" value={groupId} />
          <input type="hidden" name="groupSlug" value={groupSlug} />
          <input type="hidden" name="recordKind" value={recordKind} />

          <div className="my-4 grid gap-3">
            {recordKind === "CLOCK" ? (
              <input
                type="time"
                name="goalClock"
                aria-label={goalLabels.CLOCK}
                defaultValue={
                  goalMinutes === null ? "" : formatClock(goalMinutes)
                }
                className="w-40 font-mono tabular-nums"
              />
            ) : (
              <span className="flex items-center gap-2 text-[15px]">
                <input
                  type="number"
                  name="goalHours"
                  min={0}
                  max={24}
                  step={1}
                  aria-label="목표 시간(시)"
                  defaultValue={
                    goalMinutes === null ? "" : Math.floor(goalMinutes / 60)
                  }
                  className="w-20 tabular-nums"
                />
                시간
                <input
                  type="number"
                  name="goalMinutes"
                  min={0}
                  max={59}
                  step={1}
                  aria-label="목표 시간(분)"
                  defaultValue={goalMinutes === null ? "" : goalMinutes % 60}
                  className="w-20 tabular-nums"
                />
                분
              </span>
            )}
            <p className="text-[13px] text-sub">
              이 그룹에서만 쓰는 목표입니다. 비워 두면 목표 없이 기록만 남깁니다.
            </p>
            <p className="text-[13px] text-sub">
              목표는 지금의 기준이라, 바꾸면 지난 칸의 표시도 새 목표로 다시
              셉니다. 남은 기록 자체는 달라지지 않습니다.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
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
