"use client";

import { useEffect, useRef, useState } from "react";

import { updateGroupSettingsAction } from "@/app/actions/groups";
import { DiscordMark } from "@/components/discord-mark";
import {
  RECORD_KINDS,
  recordKindLabels,
  type RecordKind,
} from "@/lib/record-goal";

/**
 * 고르는 자리에서는 ‘시각’·‘시간’ 두 글자로 가르지 않습니다. 한 글자 차이라 잘못 읽기 쉽고,
 * 정작 궁금한 것은 무엇이 남느냐입니다. 그래서 제목을 질문으로 두고 짧은 이름은 옆에 답니다.
 */
const recordKindTitles: Record<RecordKind, string> = {
  NONE: "도장만 찍기",
  CLOCK: "몇 시에 했는지",
  DURATION: "얼마나 했는지",
};

const recordKindNotes: Record<RecordKind, string> = {
  NONE: "지금 그대로입니다. 도장 하나로 끝납니다.",
  CLOCK: "도장을 찍으면 그 시각이 함께 남습니다. 기상 스터디처럼 몇 시였는지가 중요할 때 씁니다.",
  DURATION:
    "시작할 때와 끝낼 때 두 번 찍으면 그사이가 남습니다. 착석 스터디처럼 얼마나 오래 했는지가 중요할 때 씁니다.",
};

/** 자주 여는 화면이 아니라 본문에 두지 않고 헤더에서 모달로 엽니다. */
export function GroupSettingsDialog({
  groupId,
  groupSlug,
  autoApprove,
  isPublic,
  requiresPhoto,
  isCodingStudy,
  recordKind,
  hasWebhook,
  discordInviteUrl,
}: {
  groupId: string;
  groupSlug: string;
  autoApprove: boolean;
  isPublic: boolean;
  requiresPhoto: boolean;
  isCodingStudy: boolean;
  recordKind: RecordKind;
  hasWebhook: boolean;
  discordInviteUrl: string | null;
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
        className="grid size-9 shrink-0 place-items-center rounded-control text-sub hover:bg-soft hover:text-ink"
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
        className="m-auto max-h-[calc(100dvh-40px)] w-[min(520px,calc(100%-32px))] overflow-y-auto rounded-surface border border-line bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        {/* 취소하고 다시 열면 저장된 값으로 돌아오도록 폼을 다시 그립니다. */}
        <form
          key={open ? "open" : "closed"}
          action={updateGroupSettingsAction}
          onSubmit={() => setOpen(false)}
        >
          <div className="flex items-center justify-between gap-3">
            <h2>그룹 설정</h2>
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

            <label className="flex items-start gap-2 text-[15px]">
              <input
                type="checkbox"
                name="requiresPhoto"
                defaultChecked={requiresPhoto}
                className="mt-1"
              />
              <span>
                사진 필수
                <span className="mt-1 block text-[13px] text-sub">
                  끄면 사진 없이 한 줄 메모만으로도 도장을 찍을 수 있습니다. 켜
                  두어도 풀이 코드를 남기면 사진 없이 등록됩니다. 이미 등록된
                  기록은 그대로 둡니다.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-[15px]">
              <input
                type="checkbox"
                name="isCodingStudy"
                defaultChecked={isCodingStudy}
                className="mt-1"
              />
              <span>
                코딩 테스트 스터디
                <span className="mt-1 block text-[13px] text-sub">
                  켜면 문제 링크 입력과 ‘우리 그룹이 푼 문제’ 목록을 씁니다.
                  꺼도 이미 남긴 링크는 지워지지 않고, 다시 켜면 그대로
                  돌아옵니다.
                </span>
              </span>
            </label>

            {/* 셋을 나란히 놓고 고르게 합니다. 셀렉트는 가장 긴 항목만큼 넓어지고
                고르기 전에는 하나밖에 못 읽어, 처음 한 번 정하는 설정에 맞지 않습니다. */}
            <fieldset className="border-0 p-0">
              <legend className="p-0 text-[15px]">기록 종류</legend>
              <div className="mt-2 grid gap-3">
                {RECORD_KINDS.map((kind) => (
                  <label
                    key={kind}
                    className="flex items-start gap-2 text-[15px]"
                  >
                    <input
                      type="radio"
                      name="recordKind"
                      value={kind}
                      defaultChecked={recordKind === kind}
                      className="mt-1"
                    />
                    <span>
                      {recordKindTitles[kind]}
                      {kind !== "NONE" && (
                        <span className="ml-1.5 text-[13px] text-sub">
                          {recordKindLabels[kind]}
                        </span>
                      )}
                      <span className="mt-1 block text-[13px] text-sub">
                        {recordKindNotes[kind]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 text-[13px] text-sub">
                목표는 멤버마다 따로 정합니다. 바꿔도 이미 찍은 도장은
                그대로입니다.
              </p>
            </fieldset>

            {/* 주소는 저장하고 나면 다시 보여주지 않습니다. 그 주소를 아는 사람은
                누구나 그 채널에 글을 쓸 수 있어 브라우저로 내려보내지 않습니다. */}
            <div>
              <label className="flex items-start gap-2 text-[15px]">
                <input
                  type="checkbox"
                  name="discordEnabled"
                  defaultChecked={hasWebhook}
                  className="mt-1"
                />
                <span>
                  디스코드 알림
                  {/* 저장된 주소는 되읽지 못하니, 연동됐다는 사실만이라도 보여줍니다. */}
                  {hasWebhook && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 align-middle text-[12px] text-sub">
                      <DiscordMark className="size-3 text-[#5865f2]" />
                      연동됨
                    </span>
                  )}
                  <span className="mt-1 block text-[13px] text-sub">
                    누가 착석하고 퇴근했는지, 응원과 검수가 오갔는지를 디스코드
                    채널에 한 줄씩 올립니다. 쓰고 있는 서버의 서버 설정 → 연동 →
                    웹훅에서 주소를 만들어 붙여넣으세요.
                  </span>
                </span>
              </label>
              <input
                type="url"
                name="webhookUrl"
                autoComplete="off"
                aria-label="디스코드 웹훅 주소"
                placeholder={
                  hasWebhook
                    ? "바꿀 때만 새 주소를 붙여넣으세요"
                    : "https://discord.com/api/webhooks/..."
                }
                className="mt-2"
              />
              <p className="mt-2 text-[13px] text-sub">
                {hasWebhook
                  ? "주소는 저장된 뒤로 다시 보이지 않습니다. 체크를 풀고 저장하면 지워집니다."
                  : "주소를 아는 사람은 누구나 그 채널에 글을 쓸 수 있어, 저장한 뒤에는 다시 보여주지 않습니다."}
              </p>

              {/* 초대 링크는 웹훅 주소에서 알아낼 수 없어 따로 받습니다. 남에게 주라고
                  있는 값이라 웹훅과 달리 저장한 것을 그대로 보여주고, 지울 때는 비우면 됩니다. */}
              <input
                type="url"
                name="discordInviteUrl"
                autoComplete="off"
                aria-label="디스코드 초대 링크"
                defaultValue={discordInviteUrl ?? ""}
                placeholder="https://discord.gg/... (초대 링크, 선택)"
                className="mt-3"
              />
              <p className="mt-2 text-[13px] text-sub">
                초대 링크를 넣으면 멤버 화면에 ‘디스코드에서 알림 받기’ 단추가
                생깁니다. 서버 이름 → 초대하기에서 만들고, 만료 기간을 ‘없음’으로
                두세요. 기간이 지나면 단추만 남고 열리지 않습니다.
              </p>
            </div>
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
