"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  createProofRecordAction,
  finishSeatRecordAction,
} from "@/app/actions/proofs";
import { Seal } from "@/components/seal";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_PROBLEM_URL_LENGTH,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  PROBLEM_URL_ERROR,
  MAX_SOURCE_PHOTO_BYTES,
  PHOTO_EXTENSIONS,
  photoError,
  problemLink,
} from "@/lib/proof-input";
import { compressPhoto } from "@/lib/compress-photo";
import {
  compareGoal,
  formatClock,
  formatDuration,
  formatOpenSeat,
  formatSeatRange,
  MAX_RECORD_MINUTES,
  nowClockMinutes,
  type RecordKind,
} from "@/lib/record-goal";

function displaySize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function ProofForm({
  groupId,
  groupSlug,
  userId,
  autoApprove,
  requiresPhoto,
  isCodingStudy,
  recordKind,
  goalMinutes,
  seatStartMinutes,
  seatFinished,
}: {
  groupId: string;
  groupSlug: string;
  userId: string;
  autoApprove: boolean;
  requiresPhoto: boolean;
  isCodingStudy: boolean;
  recordKind: RecordKind;
  goalMinutes: number | null;
  /** 오늘 착석해 둔 기록의 시각입니다. 아직 앉지 않았으면 null입니다. */
  seatStartMinutes: number | null;
  /** 오늘 기록이 이미 끝났는지입니다. 하루는 한 구간입니다. */
  seatFinished: boolean;
}) {
  const router = useRouter();
  // 시각·시간은 그 자체가 근거라, 기록을 남기는 그룹은 사진이 없어도 도장이 찍힙니다.
  const photoRequired = requiresPhoto && recordKind === "NONE";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [stamped, setStamped] = useState(false);
  const [linkPlatform, setLinkPlatform] = useState("");
  const [preparing, setPreparing] = useState(false);
  // 서버에서 그린 시각과 어긋나지 않도록 모달을 열 때 채웁니다.
  const [clockMinutes, setClockMinutes] = useState(nowClockMinutes);
  const [prepared, setPrepared] = useState<{
    file: File;
    blob: Blob;
    url: string;
  } | null>(null);
  // 방금 찍은 퇴근 도장의 결과입니다. 화면을 다시 그리기 전에도 보여줍니다.
  const [finishedSeat, setFinishedSeat] = useState<{
    startMinutes: number;
    recordMinutes: number;
  } | null>(null);
  // 착석 스터디는 오늘 상태에 따라 도장이 갈립니다. 끝난 날이 가장 먼저입니다.
  const seatDone =
    recordKind === "DURATION" && (seatFinished || finishedSeat !== null);
  const seatOpen =
    recordKind === "DURATION" && !seatDone && seatStartMinutes !== null;
  // 자정을 넘겨 앉아 있어도 하루를 넘지 않게 하루 길이로 나눕니다.
  const seatElapsed =
    seatStartMinutes === null
      ? 0
      : (clockMinutes - seatStartMinutes + MAX_RECORD_MINUTES) %
        MAX_RECORD_MINUTES;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  useEffect(
    () => () => {
      if (prepared) URL.revokeObjectURL(prepared.url);
    },
    [prepared],
  );
  useEffect(
    () => () => {
      selection.current++;
    },
    [],
  );
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  // 도장을 찍는 순간이 곧 기록이라, 열려 있는 동안 1분마다 시각을 다시 읽습니다.
  // 앉아 있는 중에는 흐른 시간이 이 값에서 나옵니다.
  useEffect(() => {
    if (!open || recordKind === "NONE" || seatDone) return;
    // 여는 순간의 시각은 버튼이 이미 맞춰 두었고, 여기서는 1분마다 따라가기만 합니다.
    const timer = setInterval(() => setClockMinutes(nowClockMinutes()), 60_000);
    return () => clearInterval(timer);
  }, [open, recordKind, seatDone]);
  // 등록을 마치면 모달이 닫히므로 결과는 잠깐 뜨는 알림으로 알립니다.
  useEffect(() => {
    if (open || !message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [open, message]);
  const upload = useRef<{ file: File; path: string; size: number } | null>(
    null,
  );
  // 사진이 없는 기록에는 경로가 없으므로 이 열쇠가 재시도 중복을 막습니다.
  const recordKey = useRef("");
  const correctionHours = useRef<HTMLInputElement>(null);
  const correctionMinutes = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  async function prepare(file: File | undefined) {
    const current = ++selection.current;
    setPrepared(null);
    setMessage("");
    setPreparing(Boolean(file));
    if (!file) return;
    try {
      const blob = await compressPhoto(file);
      if (current !== selection.current) return;
      setPrepared({ file, blob, url: URL.createObjectURL(blob) });
    } catch (error) {
      if (current === selection.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "사진을 압축하지 못했습니다.",
        );
    } finally {
      if (current === selection.current) setPreparing(false);
    }
  }

  /** 캡처를 복사해 붙여넣으면 파일을 고른 것과 같게 처리합니다. */
  function pastePhoto(event: ClipboardEvent<HTMLFormElement>) {
    const input = photoInput.current;
    if (busy || !input) return;
    const file = [...(event.clipboardData?.files ?? [])].find((item) =>
      item.type.startsWith("image/"),
    );
    // 이미지가 없으면 글자 붙여넣기를 막지 않습니다.
    if (!file) return;
    event.preventDefault();
    const transfer = new DataTransfer();
    transfer.items.add(file);
    // 제출과 필수 입력 확인이 모두 이 입력을 보므로 값까지 채웁니다.
    input.files = transfer.files;
    void prepare(file);
  }

  /**
   * 퇴근 도장입니다. 저장은 함수 하나가 맡아 착석 시각과의 차이를 시간으로 채웁니다.
   * `minutes`를 주면 그 시간으로 고칩니다 — 퇴근 도장을 잊은 날의 보정입니다.
   */
  async function finishSeat(minutes: number | null) {
    if (submitting.current) return;
    submitting.current = true;
    setStamped(false);
    setBusy(true);
    setMessage("도장을 찍고 있습니다.");
    try {
      const result = await finishSeatRecordAction({
        groupId,
        groupSlug,
        minutes,
      });
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setFinishedSeat(result);
      setStamped(true);
      setOpen(false);
      setMessage(
        `도장을 찍었습니다. ${formatSeatRange(
          result.startMinutes,
          result.recordMinutes,
        )} · ${formatDuration(result.recordMinutes)}`,
      );
      router.refresh();
    } catch {
      setMessage(
        "처리 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  /** 퇴근 시각이 지금이 아닐 때 두 칸에 적은 시간으로 채웁니다. */
  function correctSeat() {
    const hours = Number((correctionHours.current?.value ?? "").trim() || 0);
    const rest = Number((correctionMinutes.current?.value ?? "").trim() || 0);
    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(rest) ||
      hours < 0 ||
      hours > 24 ||
      rest < 0 ||
      rest > 59
    ) {
      setMessage("시간은 0~24, 분은 0~59로 적어주세요.");
      return;
    }
    const minutes = hours * 60 + rest;
    if (!minutes) {
      setMessage("얼마나 앉아 있었는지 적어야 도장을 찍을 수 있습니다.");
      return;
    }
    if (minutes > MAX_RECORD_MINUTES) {
      setMessage(
        `기록은 ${formatDuration(MAX_RECORD_MINUTES)}까지 적을 수 있습니다.`,
      );
      return;
    }
    void finishSeat(minutes);
  }

  /** 보정 칸에서 누른 Enter는 지금 시각이 아니라 적은 시간으로 찍습니다. */
  function correctOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    correctSeat();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    // 앉아만 둔 날의 제출은 퇴근 도장입니다. 남길 것이 시간뿐이라 여기서 갈립니다.
    if (seatOpen) {
      await finishSeat(null);
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const fileInput = form.elements.namedItem("photo") as HTMLInputElement;
    const file = fileInput.files?.[0];
    const hasFile = file instanceof File;
    if (!hasFile && photoRequired) return;
    let compressed: Blob | null = null;
    if (hasFile) {
      if (preparing || !prepared || prepared.file !== file) {
        setMessage("사진 압축이 끝나면 등록할 수 있습니다.");
        return;
      }
      const validationError = photoError(file, MAX_SOURCE_PHOTO_BYTES);
      if (validationError) {
        setMessage(validationError);
        return;
      }
      compressed = prepared.blob;
    }
    const problemUrl = isCodingStudy
      ? String(data.get("problemUrl") ?? "").trim()
      : "";
    if (problemUrl && !problemLink(problemUrl)) {
      setMessage(PROBLEM_URL_ERROR);
      return;
    }
    // 시각은 도장을 찍는 순간이 곧 기록이고, 착석은 지금 시각이 시작점입니다.
    // 시간은 일어날 때 찍는 퇴근 도장이 채웁니다.
    const recordMinutes = recordKind === "CLOCK" ? clockMinutes : null;
    const startMinutes = recordKind === "DURATION" ? clockMinutes : null;
    submitting.current = true;
    setStamped(false);
    setBusy(true);
    setMessage(hasFile ? "사진을 올리고 있습니다." : "도장을 찍고 있습니다.");
    try {
      if (hasFile && compressed && (!upload.current || upload.current.file !== file)) {
        const previousPath = upload.current?.path;
        setMessage(
          `사진 업로드 중: ${displaySize(file.size)} → ${displaySize(compressed.size)}`,
        );
        const supabase = createClient();
        const path = `${groupId}/${userId}/${crypto.randomUUID()}.${PHOTO_EXTENSIONS[compressed.type]}`;
        const { error } = await supabase.storage
          .from("proof-evidence")
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });
        if (error) {
          setMessage(
            "사진을 올리지 못했습니다. 로그인 상태와 네트워크를 확인해주세요.",
          );
          return;
        }
        upload.current = { file, path, size: compressed.size };
        if (previousPath) {
          // 이미 기록에 연결된 사진은 Storage 정책에서 삭제를 차단합니다.
          await supabase.storage.from("proof-evidence").remove([previousPath]);
        }
      }
      if (!hasFile && !recordKey.current) recordKey.current = crypto.randomUUID();
      const result = await createProofRecordAction({
        groupId,
        groupSlug,
        evidencePath: hasFile ? (upload.current?.path ?? "") : "",
        recordKey: recordKey.current,
        title: String(data.get("title") ?? ""),
        tags: String(data.get("tags") ?? ""),
        problemUrl,
        recordMinutes,
        startMinutes,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const storedSize = upload.current?.size;
      upload.current = null;
      recordKey.current = "";
      form.reset();
      setLinkPlatform("");
      setPrepared(null);
      setStamped(true);
      setOpen(false);
      const stored =
        hasFile && storedSize
          ? ` (${displaySize(file.size)} → ${displaySize(storedSize)})`
          : "";
      setMessage(
        startMinutes === null
          ? `도장을 찍었습니다${stored}. ${
              result.autoApproved
                ? "바로 인정됐습니다."
                : "검수를 기다려주세요."
            }`
          : `${formatClock(startMinutes)}에 착석 도장을 찍었습니다. 일어날 때 퇴근 도장을 찍어주세요.`,
      );
      router.refresh();
    } catch {
      setMessage(
        "처리 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const openLabel = "도장 찍기";
  const dialogTitle = "도장 찍기";
  // 착석 스터디는 앉을 때와 일어날 때 찍는 도장의 이름이 다릅니다.
  const submitLabel = seatOpen
    ? "퇴근 도장 찍기"
    : recordKind === "DURATION" && !seatDone
      ? "착석 도장 찍기"
      : "도장 찍기";

  const photoField = (
    <>
      <div className="grid justify-items-center gap-2 rounded-control border border-dashed border-line px-4 py-6 text-center text-sub">
        <label htmlFor="proof-photo" className="text-[15px]">
          {isCodingStudy ? "풀이 결과가 보이는 사진 한 장" : "인증 사진 한 장"}
          {!photoRequired && (
            <span className="ml-1 text-[13px]">선택 사항</span>
          )}
        </label>
        <input
          id="proof-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required={photoRequired}
          disabled={busy}
          ref={photoInput}
          onChange={(event) => prepare(event.target.files?.[0])}
          className="text-[13px]"
          aria-describedby="photo-help"
        />
        <p id="photo-help" className="text-[13px]">
          복사한 캡처를 붙여넣어도 됩니다 · 20MB까지
          {!photoRequired && " · 사진 없이 등록해도 됩니다"}
        </p>
      </div>

      {preparing && (
        <p role="status" className="text-[15px]">
          사진 용량을 줄이고 있습니다…
        </p>
      )}

      {prepared && (
        <div className="grid gap-2">
          <p className="text-[15px] font-medium">
            저장될 사진: {displaySize(prepared.file.size)} →{" "}
            {displaySize(prepared.blob.size)}
          </p>
          <a href={prepared.url} target="_blank" rel="noreferrer">
            <Image
              src={prepared.url}
              alt="업로드할 압축 사진 미리보기"
              width={640}
              height={480}
              unoptimized
              className="max-h-72 w-full rounded-control bg-soft object-contain"
            />
            <span className="mt-1 block text-[13px] text-sub underline">
              크게 열어 글자 확인
            </span>
          </a>
        </div>
      )}
    </>
  );

  // 기상 스터디는 도장을 찍는 순간이 곧 기록이라 입력 칸 대신 지금 시각을 보여줍니다.
  const clockGoal = compareGoal("CLOCK", clockMinutes, goalMinutes);

  const clockField = (
    <div className="grid gap-2">
      <p className="text-[15px]">
        지금 시각
        {goalMinutes !== null && (
          <span className="ml-1 text-[13px] text-sub">
            목표 {formatClock(goalMinutes)}
          </span>
        )}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-control bg-brand-soft px-4 py-3">
        <span className="font-mono text-[32px] leading-tight tabular-nums">
          {formatClock(clockMinutes)}
        </span>
        {clockGoal && (
          <span className="text-[13px] text-sub">{clockGoal.description}</span>
        )}
      </div>
      <p className="text-[13px] text-sub">
        도장을 찍으면 이 시각이 기록으로 남습니다.
      </p>
    </div>
  );

  // 착석 스터디는 앉을 때 한 번, 일어날 때 한 번 찍습니다. 그 차이가 그날의 시간입니다.
  const goalNote = goalMinutes !== null && (
    <span className="ml-1 text-[13px] text-sub">
      목표 {formatDuration(goalMinutes)}
    </span>
  );

  const seatStartField = (
    <div className="grid gap-2">
      <p className="text-[15px]">
        착석 시각
        {goalNote}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-control bg-brand-soft px-4 py-3">
        <span className="font-mono text-[32px] leading-tight tabular-nums">
          {formatClock(clockMinutes)}
        </span>
      </div>
      <p className="text-[13px] text-sub">
        지금부터 앉습니다. 일어날 때 퇴근 도장을 찍으면 시간이 계산됩니다.
      </p>
    </div>
  );

  const openSeatGoal = compareGoal("DURATION", seatElapsed, goalMinutes);

  const seatOpenField = seatStartMinutes === null ? null : (
    <div className="grid gap-2">
      <p className="text-[15px]">
        앉아 있는 중
        {goalNote}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-control bg-brand-soft px-4 py-3">
        <span className="font-mono text-[32px] leading-tight tabular-nums">
          {formatOpenSeat(seatStartMinutes)}
        </span>
        <span className="text-[15px]">{formatDuration(seatElapsed)}</span>
        {openSeatGoal && (
          <span className="text-[13px] text-sub">
            {openSeatGoal.description}
          </span>
        )}
      </div>
      <p className="text-[13px] text-sub">
        퇴근 도장을 찍으면 지금까지의 시간이 기록으로 남습니다.
      </p>
      {/* 퇴근 시각이 지금이 아닐 때 쓰는 통로라 접어 둡니다. */}
      <details className="rounded-control border border-line px-4 py-3">
        <summary className="text-[13px] text-sub">
          퇴근 시각이 지금이 아닌가요?
        </summary>
        <div className="mt-3 grid gap-2">
          <label htmlFor="proof-duration-hours" className="text-[13px] text-sub">
            앉아 있던 시간을 직접 적습니다.
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="proof-duration-hours"
              name="durationHours"
              type="number"
              inputMode="numeric"
              min={0}
              max={24}
              step={1}
              disabled={busy}
              ref={correctionHours}
              onKeyDown={correctOnEnter}
              className="w-20"
            />
            <span className="text-[15px]">시간</span>
            <input
              id="proof-duration-minutes"
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              step={1}
              disabled={busy}
              ref={correctionMinutes}
              onKeyDown={correctOnEnter}
              className="w-20"
            />
            <span className="text-[15px]">분</span>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={correctSeat}
            >
              직접 적기
            </button>
          </div>
        </div>
      </details>
    </div>
  );

  const seatDoneField = (
    <div className="grid gap-2">
      <p className="text-[15px]">오늘 기록이 끝났습니다</p>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-control bg-brand-soft px-4 py-3">
        {finishedSeat ? (
          <>
            <span className="font-mono text-[32px] leading-tight tabular-nums">
              {formatDuration(finishedSeat.recordMinutes)}
            </span>
            <span className="text-[15px]">
              {formatSeatRange(
                finishedSeat.startMinutes,
                finishedSeat.recordMinutes,
              )}
            </span>
          </>
        ) : (
          <span className="font-mono text-[32px] leading-tight tabular-nums">
            {seatStartMinutes === null
              ? "기록 완료"
              : `${formatClock(seatStartMinutes)} 착석`}
          </span>
        )}
      </div>
      <p className="text-[13px] text-sub">
        하루는 한 구간이라 오늘은 더 찍을 수 없습니다.
      </p>
    </div>
  );

  const titleField = (
    <div className="grid gap-2">
      <label htmlFor="proof-title" className="text-[15px]">
        {isCodingStudy ? "문제 제목" : "한 줄 메모"}{" "}
        <span className="text-[13px] text-sub">선택 사항</span>
      </label>
      <input
        id="proof-title"
        name="title"
        maxLength={160}
        disabled={busy}
        placeholder={isCodingStudy ? "예: 더 맵게" : "예: 6시 기상"}
      />
    </div>
  );

  const tagField = (
    <div className="grid gap-2">
      <label htmlFor="proof-tags" className="text-[15px]">
        주제 태그 <span className="text-[13px] text-sub">선택 사항</span>
      </label>
      <input
        id="proof-tags"
        name="tags"
        disabled={busy}
        placeholder={isCodingStudy ? "예: 해시, 정렬" : "예: 새벽, 러닝"}
        aria-describedby="tags-help"
      />
      <p id="tags-help" className="text-[13px] text-sub">
        쉼표로 나눠 적습니다. {MAX_TAGS}개까지, 하나에 {MAX_TAG_LENGTH}자까지요.
        나중에 무엇을 연습해왔는지 훑어볼 때 씁니다.
      </p>
    </div>
  );

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          // 닫아 둔 사이 흐른 시간을 여는 순간 따라잡습니다.
          setClockMinutes(nowClockMinutes());
          setOpen(true);
        }}
      >
        <Seal className="size-5 text-primary-ink" tilt="-6deg" />
        {openLabel}
      </button>
      {!open && message && (
        <p
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-10 flex w-max max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 rounded-control border border-line bg-surface px-4 py-3 text-[15px] shadow-[0_4px_20px_rgba(0,0,0,0.13)]"
        >
          {stamped && <Seal className="size-8 shrink-0" press />}
          {message}
        </p>
      )}

      <dialog
        ref={dialogRef}
        aria-label={dialogTitle}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current && !busy) setOpen(false);
        }}
        className="m-auto max-h-[calc(100dvh-40px)] w-[min(620px,calc(100%-32px))] overflow-y-auto rounded-surface border border-line bg-surface p-6 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={submit} onPaste={pastePhoto}>
          <div className="flex items-center justify-between gap-3">
            <h2>
              {isCodingStudy ? "오늘 푼 문제를 공유해요" : "오늘의 인증"}
            </h2>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
          </div>

          <div className="my-4 grid gap-5">
            {/* 기록이 이 그룹 인증의 알맹이라 맨 앞에 둡니다. */}
            {recordKind === "CLOCK" && clockField}
            {recordKind === "DURATION" &&
              (seatDone
                ? seatDoneField
                : seatOpen
                  ? seatOpenField
                  : seatStartField)}
            {/* 퇴근 도장은 시간만 채우므로 남길 자리가 없는 입력은 감춥니다. */}
            {!seatOpen && !seatDone && (
              <>
                {/* 사진이 선택이면 먼저 쓰는 것은 메모라, 사진 영역을 뒤로 보냅니다. */}
                {photoRequired ? (
                  <>
                    {photoField}
                    {titleField}
                  </>
                ) : (
                  <>
                    {titleField}
                    {photoField}
                  </>
                )}
                {tagField}
              </>
            )}

            {!seatOpen && !seatDone && isCodingStudy && (
              <div className="grid gap-2">
                <label htmlFor="proof-problem-url" className="text-[15px]">
                  문제 링크{" "}
                  <span className="text-[13px] text-sub">선택 사항</span>
                </label>
                <input
                  id="proof-problem-url"
                  name="problemUrl"
                  inputMode="url"
                  maxLength={MAX_PROBLEM_URL_LENGTH}
                  disabled={busy}
                  placeholder="https://school.programmers.co.kr/learn/courses/30/lessons/12345"
                  aria-describedby="problem-url-help"
                  onChange={(event) =>
                    setLinkPlatform(
                      problemLink(event.target.value.trim())?.platform ?? "",
                    )
                  }
                />
                <p id="problem-url-help" className="text-[13px] text-sub">
                  {linkPlatform ? (
                    // 주소를 알아봤다는 걸 바로 돌려줍니다. 틀린 주소는 등록할 때 알립니다.
                    <span className="inline-flex items-center gap-1.5 text-brand">
                      <span aria-hidden="true">✓</span>
                      {linkPlatform} 문제로 남깁니다. 다른 멤버가 바로 풀어볼 수
                      있습니다.
                    </span>
                  ) : (
                    <>
                      프로그래머스, 백준, LeetCode, Codeforces, AtCoder,
                      HackerRank, Codewars의 https 주소만 받습니다. 넣으면 다른
                      멤버가 같은 문제를 바로 풀어볼 수 있습니다.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-sub">
              {seatDone
                ? "오늘 기록은 이미 끝났습니다. 내일 다시 앉을 때 찍어주세요."
                : seatOpen
                  ? "퇴근 도장을 찍으면 착석 시각과의 차이가 시간으로 남습니다."
                  : autoApprove
                    ? "등록 시각이 기록되고 바로 인정됩니다."
                    : "등록 시각이 기록되고 검수 대기 상태가 됩니다."}
            </span>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* 버튼이 왜 눌리지 않는지 그 자리에서 알려줍니다. */}
              {photoRequired && !prepared && !preparing && !busy && (
                <span className="max-w-[280px] text-[13px] text-sub">
                  사진을 고르면 도장을 찍을 수 있습니다. 사진 필수는 스터디 이름
                  옆 설정에서 끌 수 있습니다.
                </span>
              )}
              <button
                type="submit"
                disabled={
                  busy || preparing || (photoRequired && !prepared) || seatDone
                }
                className="btn btn-primary min-h-12 gap-2 rounded-[10px] px-5 text-[16px]"
              >
                <Seal className="size-6 text-primary-ink" tilt="-6deg" />
                {busy ? "찍는 중…" : submitLabel}
              </button>
            </div>
          </div>
          <p role="status" aria-live="polite" className="mt-3 text-[15px]">
            {message}
          </p>
        </form>
      </dialog>
    </>
  );
}
