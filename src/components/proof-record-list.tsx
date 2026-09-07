"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { deleteProofAction, reviewProofAction } from "@/app/actions/proofs";
import { CancelProofButton } from "@/components/cancel-proof-button";

export type ProofRecord = {
  id: string;
  title: string;
  memberName: string;
  isMine: boolean;
  date: string;
  time: string;
  registeredAt: string;
  statusLabel: string;
  statusTone: "approved" | "pending" | "rejected";
  source: string;
  hasPhoto: boolean;
  problemUrl: string | null;
  problemPlatform: string | null;
  reviewLabel: string | null;
  reviewNote: string | null;
  reviewable: boolean;
  cancelable: boolean;
  cancelRetry: boolean;
};

const toneClass = {
  approved: "text-brand",
  pending: "text-warn",
  rejected: "text-danger",
} as const;

export function ProofRecordList({
  records,
  groupSlug,
  emptyTitle,
  emptyDescription,
}: {
  records: ProofRecord[];
  groupSlug: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteError, setNoteError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const index = records.findIndex((record) => record.id === openId);
  const record = index >= 0 ? records[index] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (record && !dialog.open) dialog.showModal();
    if (!record && dialog.open) dialog.close();
  }, [record]);

  function open(id: string) {
    setNoteError("");
    setOpenId(id);
  }

  if (records.length === 0) {
    return (
      <div className="flex min-h-[360px] flex-col justify-center px-4 py-8 text-center text-sub">
        <strong className="mb-[5px] block text-[15px] font-semibold text-ink">
          {emptyTitle}
        </strong>
        {emptyDescription}
      </div>
    );
  }

  return (
    <div className="min-h-[360px]">
      {records.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => open(item.id)}
          aria-label={`${item.title} ${item.memberName} ${item.statusLabel} 상세 보기`}
          className="grid w-full grid-cols-[30px_minmax(0,1fr)_60px_12px] items-center gap-2 border-b border-line px-0.5 py-[14px] text-left hover:bg-soft sm:grid-cols-[36px_minmax(0,1fr)_100px_74px_18px] sm:gap-[14px]"
        >
          <span className="relative grid size-[30px] place-items-center overflow-hidden rounded-[7px] bg-soft text-sub sm:size-[34px]">
            {item.hasPhoto ? (
              <Image
                src={`/proofs/${item.id}/evidence`}
                alt=""
                fill
                sizes="34px"
                loading="lazy"
                unoptimized
                className="object-cover"
              />
            ) : (
              <span aria-hidden="true" className="text-[13px]">
                ▤
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{item.title}</span>
            <span className="mt-[3px] block truncate text-xs text-sub">
              {item.memberName}
              {item.isMine ? " · 나" : ""}
            </span>
          </span>
          <span className="hidden text-xs text-sub tabular-nums sm:block">
            {item.date} · {item.time}
          </span>
          <span
            className={`text-xs whitespace-nowrap ${toneClass[item.statusTone]}`}
          >
            {item.statusLabel}
          </span>
          <span aria-hidden="true" className="text-xs text-sub">
            ›
          </span>
        </button>
      ))}

      <dialog
        ref={dialogRef}
        aria-label="풀이 상세 및 검수"
        onClose={() => setOpenId(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenId(null);
        }}
        className="m-auto h-[min(680px,calc(100dvh-48px))] w-[min(960px,calc(100%-48px))] overflow-hidden rounded-[14px] border border-line bg-canvas p-0 text-ink backdrop:bg-black/40 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-full max-sm:rounded-none max-sm:border-0"
      >
        {record && (
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
            <header className="flex min-w-0 items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h3 className="truncate">{record.title}</h3>
                <p className="text-xs text-sub">
                  {record.memberName} · {record.date} {record.time}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpenId(null)}
              >
                닫기
              </button>
            </header>

            <div className="grid min-h-0 overflow-hidden max-sm:flex max-sm:flex-col max-sm:overflow-y-auto sm:grid-cols-[minmax(0,1fr)_256px]">
              <div className="relative flex min-h-0 flex-col items-center justify-center gap-3 bg-soft p-6 text-center max-sm:h-60 max-sm:shrink-0">
                {record.hasPhoto ? (
                  <a
                    href={`/proofs/${record.id}/evidence`}
                    target="_blank"
                    rel="noreferrer"
                    className="relative size-full"
                  >
                    <Image
                      src={`/proofs/${record.id}/evidence`}
                      alt="풀이 인증 사진"
                      fill
                      sizes="(max-width: 640px) 100vw, 700px"
                      unoptimized
                      className="object-contain"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-sub">
                    사진 없이 등록된 기록입니다.
                  </p>
                )}
              </div>

              <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto border-line p-5 max-sm:border-t sm:border-l sm:p-6">
                <div className="flex items-center justify-between gap-2">
                  <h2>인증 정보</h2>
                  <span
                    className={`text-xs whitespace-nowrap ${toneClass[record.statusTone]}`}
                  >
                    {record.statusLabel}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-sub">작성자</p>
                  <p>{record.memberName}</p>
                </div>
                <div>
                  <p className="text-xs text-sub">등록 시각</p>
                  <p className="text-[13px]">{record.registeredAt}</p>
                </div>
                <div>
                  <p className="text-xs text-sub">출처</p>
                  <p className="text-[13px]">{record.source}</p>
                </div>
                {record.problemUrl && (
                  <a
                    href={record.problemUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn"
                  >
                    {record.problemPlatform}에서 풀어보기 ↗
                  </a>
                )}

                {record.reviewable ? (
                  <form action={reviewProofAction} className="grid gap-2">
                    <input type="hidden" name="proofId" value={record.id} />
                    <input type="hidden" name="groupSlug" value={groupSlug} />
                    <label
                      htmlFor="review-note"
                      className="text-xs text-sub"
                    >
                      피드백
                    </label>
                    <textarea
                      id="review-note"
                      ref={noteRef}
                      name="note"
                      rows={4}
                      maxLength={500}
                      placeholder="반려할 때는 이유를 남겨주세요."
                    />
                    {noteError && (
                      <p role="alert" className="text-xs text-danger">
                        {noteError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        name="decision"
                        value="REJECTED"
                        className="btn flex-1"
                        onClick={(event) => {
                          if (noteRef.current?.value.trim()) return;
                          event.preventDefault();
                          setNoteError("반려 이유를 입력해주세요.");
                          noteRef.current?.focus();
                        }}
                      >
                        반려
                      </button>
                      <button
                        type="submit"
                        name="decision"
                        value="APPROVED"
                        className="btn btn-primary flex-1"
                      >
                        승인하기
                      </button>
                    </div>
                  </form>
                ) : record.reviewLabel ? (
                  <div>
                    <p className="text-xs text-sub">검수 피드백</p>
                    <p className="text-[13px]">
                      {record.reviewLabel}
                      {record.reviewNote ? ` · ${record.reviewNote}` : ""}
                    </p>
                  </div>
                ) : record.statusTone === "pending" ? (
                  <p className="text-xs text-sub">
                    다른 검수자의 확인을 기다리고 있어요.
                  </p>
                ) : null}

                {record.cancelable && (
                  <form action={deleteProofAction}>
                    <input type="hidden" name="proofId" value={record.id} />
                    <input type="hidden" name="groupSlug" value={groupSlug} />
                    <CancelProofButton retry={record.cancelRetry} />
                  </form>
                )}
              </aside>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn"
                  disabled={index <= 0}
                  onClick={() => open(records[index - 1].id)}
                >
                  이전
                </button>
                <span className="min-w-10 text-center text-xs text-sub tabular-nums">
                  {index + 1} / {records.length}
                </span>
                <button
                  type="button"
                  className="btn"
                  disabled={index >= records.length - 1}
                  onClick={() => open(records[index + 1].id)}
                >
                  다음
                </button>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setOpenId(null)}
              >
                목록으로
              </button>
            </footer>
          </div>
        )}
      </dialog>
    </div>
  );
}
