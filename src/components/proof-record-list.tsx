"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  deleteProofAction,
  reviewProofAction,
  toggleCheerAction,
} from "@/app/actions/proofs";
import { CancelProofButton } from "@/components/cancel-proof-button";
import { CheerButton, HeartIcon } from "@/components/cheer-button";
import { Seal } from "@/components/seal";

export type ProofRecord = {
  id: string;
  title: string;
  memberName: string;
  memberHandle: string | null;
  memberBio: string | null;
  isMine: boolean;
  date: string;
  time: string;
  registeredAt: string;
  statusLabel: string;
  statusTone: "approved" | "pending" | "rejected";
  source: string;
  hasPhoto: boolean;
  solutionCode: string | null;
  tags: string[];
  problemUrl: string | null;
  problemPlatform: string | null;
  reviewLabel: string | null;
  reviewNote: string | null;
  reviewable: boolean;
  cancelable: boolean;
  cancelRetry: boolean;
  /** 응원한 멤버 이름. 순서는 남긴 순입니다. */
  cheerNames: string[];
  cheered: boolean;
  /** 남의 기록이고 취소 중이 아니면 응원할 수 있습니다. */
  cheerable: boolean;
};

const toneClass = {
  approved: "text-brand",
  pending: "text-warn",
  rejected: "text-danger",
} as const;

/** 썸네일 열이 있고 없고에 따라 행 격자가 달라집니다. Tailwind가 찾을 수 있도록 통째로 적습니다. */
function rowColumns(withPhoto: boolean) {
  return withPhoto
    ? "grid-cols-[44px_minmax(0,1fr)_84px_12px] sm:grid-cols-[52px_minmax(0,1fr)_100px_96px_40px_18px]"
    : "grid-cols-[minmax(0,1fr)_84px_12px] sm:grid-cols-[minmax(0,1fr)_100px_96px_40px_18px]";
}

/** 목록을 훑을 때 상태가 먼저 보이도록 행 왼쪽에 색 막대를 둡니다. */
const toneBar = {
  approved: "border-l-brand",
  pending: "border-l-warn",
  rejected: "border-l-danger",
} as const;

/** 상태 글자 앞의 표시. 도장판과 같은 도형이라 목록과 판이 같은 말을 씁니다. */
function StatusLabel({
  tone,
  label,
}: {
  tone: ProofRecord["statusTone"];
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap ${toneClass[tone]}`}
    >
      {tone === "rejected" ? (
        <span
          aria-hidden="true"
          className="grid size-4 place-items-center rounded-[5px] border border-current text-[10px] font-[650]"
        >
          ×
        </span>
      ) : (
        <Seal ghost={tone === "pending"} className="size-[18px]" />
      )}
      {label}
    </span>
  );
}

/** 응원한 사람을 세 명까지 적고 나머지는 수로 줄입니다. */
function cheerSummary(names: string[]) {
  if (names.length === 0) return "";
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown} 외 ${names.length - 3}명` : shown;
}

/** 앞말의 받침에 따라 ‘이’와 ‘가’를 고릅니다. 닉네임이 무엇이든 문장이 자연스러워야 합니다. */
function subjectParticle(word: string) {
  const last = word.at(-1) ?? "";
  const code = last.charCodeAt(0);
  // 한글 음절이 아니면 조사를 고를 근거가 없어 받침 없는 쪽으로 둡니다.
  if (code < 0xac00 || code > 0xd7a3) return "가";
  return (code - 0xac00) % 28 ? "이" : "가";
}

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
  // 사진을 쓰지 않는 그룹에서 빈 썸네일 자리만 남지 않게 열 자체를 없앱니다.
  const showPhotos = records.some((item) => item.hasPhoto);

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
      <div className="flex flex-col justify-center px-4 py-14 text-center text-sub">
        <strong className="mb-1 block text-[17px] font-semibold text-ink">
          {emptyTitle}
        </strong>
        {emptyDescription}
      </div>
    );
  }

  return (
    <div>
      {records.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => open(item.id)}
          aria-label={`${item.title} ${item.memberName} ${item.statusLabel}${
            item.cheerNames.length ? ` 응원 ${item.cheerNames.length}` : ""
          } 상세 보기`}
          className={`grid w-full items-center gap-3 border-b border-l-[3px] border-line py-3 pr-0.5 pl-2 text-left hover:bg-soft sm:gap-4 sm:pl-3 ${rowColumns(showPhotos)} ${toneBar[item.statusTone]}`}
        >
          {showPhotos && (
            <span className="relative grid size-[44px] place-items-center overflow-hidden rounded-control bg-soft text-sub sm:size-[52px]">
              {item.hasPhoto ? (
                <Image
                  src={`/proofs/${item.id}/evidence`}
                  alt=""
                  fill
                  sizes="52px"
                  loading="lazy"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span aria-hidden="true" className="text-[17px] opacity-60">
                  ▤
                </span>
              )}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-semibold">
              {item.title}
            </span>
            <span className="mt-1 block truncate text-[13px] text-sub">
              {item.memberName}
              {item.isMine ? " · 나" : ""}
              {item.tags.length > 0 && ` · ${item.tags.join(" · ")}`}
            </span>
          </span>
          <span className="hidden font-mono text-[12px] text-sub tabular-nums sm:block">
            {item.date} {item.time}
          </span>
          <StatusLabel tone={item.statusTone} label={item.statusLabel} />
          {/* 응원 수. 없으면 자리만 지켜 열이 흔들리지 않게 합니다. */}
          <span
            className={`hidden items-center gap-1 text-[12px] tabular-nums sm:inline-flex ${
              item.cheerNames.length ? "text-sub" : "text-line"
            }`}
            aria-label={
              item.cheerNames.length ? `응원 ${item.cheerNames.length}` : undefined
            }
          >
            <HeartIcon filled={item.cheered} className="size-3.5" />
            {item.cheerNames.length || ""}
          </span>
          <span aria-hidden="true" className="text-[13px] text-sub">
            ›
          </span>
        </button>
      ))}

      {/* 사진도 코드도 없으면 채울 것이 정보뿐이라 좁게 엽니다. */}
      <dialog
        ref={dialogRef}
        aria-label="인증 상세 및 검수"
        onClose={() => setOpenId(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenId(null);
        }}
        onKeyDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest("textarea, input")) return;
          if (event.key === "ArrowLeft" && index > 0) open(records[index - 1].id);
          if (event.key === "ArrowRight" && index < records.length - 1)
            open(records[index + 1].id);
        }}
        className={`m-auto overflow-hidden rounded-surface border border-line bg-surface p-0 text-ink backdrop:bg-black/40 max-sm:h-dvh max-sm:max-h-dvh max-sm:w-full max-sm:max-w-full max-sm:rounded-none max-sm:border-0 ${
          record?.hasPhoto || record?.solutionCode
            ? "h-[min(680px,calc(100dvh-48px))] w-[min(960px,calc(100%-48px))]"
            : "max-h-[min(680px,calc(100dvh-48px))] w-[min(560px,calc(100%-48px))]"
        }`}
      >
        {record && (
          <div
            className={`grid grid-rows-[auto_minmax(0,1fr)_auto] ${
              record.hasPhoto || record.solutionCode ? "h-full" : "max-sm:h-full"
            }`}
          >
            <header className="flex min-w-0 items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-6 sm:py-4">
              <div className="min-w-0">
                <h2 className="truncate">{record.title}</h2>
                <p className="text-[13px] text-sub">
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

            <div
              className={`grid min-h-0 overflow-hidden max-sm:flex max-sm:flex-col max-sm:overflow-y-auto ${
                record.hasPhoto || record.solutionCode
                  ? "sm:grid-cols-[minmax(0,1fr)_256px]"
                  : "sm:grid-cols-1"
              }`}
            >
              {(record.hasPhoto || record.solutionCode) && (
                <div className="flex min-h-0 flex-col gap-3 overflow-hidden bg-soft p-4 max-sm:h-80 max-sm:shrink-0 sm:p-5">
                  {/* 코드와 함께 있으면 사진은 위쪽 일부만 차지합니다. */}
                  {record.hasPhoto && (
                    <a
                      href={`/proofs/${record.id}/evidence`}
                      target="_blank"
                      rel="noreferrer"
                      className={`relative ${record.solutionCode ? "h-2/5 shrink-0" : "size-full flex-1"}`}
                    >
                      <Image
                        src={`/proofs/${record.id}/evidence`}
                        alt="인증 사진"
                        fill
                        sizes="(max-width: 640px) 100vw, 700px"
                        unoptimized
                        className="object-contain"
                      />
                    </a>
                  )}
                  {record.solutionCode && (
                    // 긴 줄은 코드 상자 안에서만 가로로 흐릅니다.
                    <pre className="min-h-0 flex-1 overflow-auto rounded-control border border-line bg-surface p-4 text-left font-mono text-[13px] leading-[1.6]">
                      {record.solutionCode}
                    </pre>
                  )}
                </div>
              )}

              <aside
                className={`flex min-h-0 flex-col gap-5 overflow-y-auto border-line p-5 max-sm:border-t sm:p-6 ${
                  record.hasPhoto || record.solutionCode ? "sm:border-l" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3>인증 정보</h3>
                  <StatusLabel
                    tone={record.statusTone}
                    label={record.statusLabel}
                  />
                </div>
                {record.tags.length > 0 && (
                  <div>
                    <p className="text-[13px] text-sub">주제</p>
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {record.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-line bg-soft px-2 py-0.5 text-[13px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[13px] text-sub">작성자</p>
                  <p>
                    {record.memberName}
                    {record.memberHandle && (
                      <span className="ml-1 font-mono text-[13px] text-sub">
                        @{record.memberHandle}
                      </span>
                    )}
                  </p>
                  {record.memberBio && (
                    <p className="mt-1 text-[13px] text-sub">
                      {record.memberBio}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[13px] text-sub">등록 시각</p>
                  <p className="text-[15px]">{record.registeredAt}</p>
                </div>
                <div>
                  <p className="text-[13px] text-sub">출처</p>
                  <p className="text-[15px]">{record.source}</p>
                </div>
                {/* 응원. 검수와 무관한 하트 하나라 승인·반려 위쪽에 가볍게 둡니다. */}
                {(record.cheerable || record.cheerNames.length > 0) && (
                  <div>
                    <p className="text-[13px] text-sub">응원</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {record.cheerable && (
                        <form key={record.id} action={toggleCheerAction}>
                          <input type="hidden" name="proofId" value={record.id} />
                          <input type="hidden" name="groupSlug" value={groupSlug} />
                          <input
                            type="hidden"
                            name="cheered"
                            value={String(record.cheered)}
                          />
                          <CheerButton cheered={record.cheered} />
                        </form>
                      )}
                      {record.cheerNames.length > 0 && (
                        <p className="text-[13px] text-sub">
                          {cheerSummary(record.cheerNames)}
                          {subjectParticle(cheerSummary(record.cheerNames))}{" "}
                          응원했어요
                        </p>
                      )}
                    </div>
                  </div>
                )}
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
                  // 이전·다음으로 기록을 넘길 때 앞 기록의 피드백이 남지 않도록 다시 그립니다.
                  <form
                    key={record.id}
                    action={reviewProofAction}
                    className="grid gap-2"
                  >
                    <input type="hidden" name="proofId" value={record.id} />
                    <input type="hidden" name="groupSlug" value={groupSlug} />
                    <label
                      htmlFor="review-note"
                      className="text-[13px] text-sub"
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
                      <p role="alert" className="text-[13px] text-danger">
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
                        className="btn btn-primary flex-[1.4]"
                      >
                        <Seal className="size-5 text-primary-ink" tilt="-6deg" />
                        승인
                      </button>
                    </div>
                    <p className="text-[12px] text-sub">
                      승인하면 도장판의 점선 도장에 잉크가 채워집니다.
                    </p>
                  </form>
                ) : record.reviewLabel ? (
                  <div>
                    <p className="text-[13px] text-sub">검수 피드백</p>
                    <p className="text-[15px]">
                      {record.reviewLabel}
                      {record.reviewNote ? ` · ${record.reviewNote}` : ""}
                    </p>
                  </div>
                ) : record.statusTone === "pending" ? (
                  <p className="text-[13px] text-sub">
                    다른 검수자의 확인을 기다리고 있습니다.
                  </p>
                ) : null}

                {record.cancelable && (
                  <form action={deleteProofAction}>
                    <input type="hidden" name="proofId" value={record.id} />
                    <input type="hidden" name="groupSlug" value={groupSlug} />
                    <CancelProofButton
                      retry={record.cancelRetry}
                      hasPhoto={record.hasPhoto}
                    />
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
                <span className="min-w-10 text-center text-[13px] text-sub tabular-nums">
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
