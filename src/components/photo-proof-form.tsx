"use client";

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPhotoProofAction } from "@/app/actions/proofs";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_PROBLEM_URL_LENGTH,
  PROBLEM_URL_ERROR,
  MAX_SOURCE_PHOTO_BYTES,
  PHOTO_EXTENSIONS,
  photoError,
  problemLink,
} from "@/lib/proof-input";
import { compressPhoto } from "@/lib/compress-photo";

function displaySize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export function PhotoProofForm({
  groupId,
  groupSlug,
  userId,
}: {
  groupId: string;
  groupSlug: string;
  userId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<{
    file: File;
    blob: Blob;
    url: string;
  } | null>(null);
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
  // 등록을 마치면 모달이 닫히므로 결과는 잠깐 뜨는 알림으로 알립니다.
  useEffect(() => {
    if (open || !message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [open, message]);
  const upload = useRef<{ file: File; path: string; size: number } | null>(
    null,
  );
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const fileInput = form.elements.namedItem("photo") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!(file instanceof File)) return;
    if (preparing || !prepared || prepared.file !== file) {
      setMessage("사진 압축이 끝나면 등록할 수 있습니다.");
      return;
    }
    const validationError = photoError(file, MAX_SOURCE_PHOTO_BYTES);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    const problemUrl = String(data.get("problemUrl") ?? "").trim();
    if (problemUrl && !problemLink(problemUrl)) {
      setMessage(PROBLEM_URL_ERROR);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage("사진을 등록하고 있습니다.");
    try {
      const supabase = createClient();
      if (!upload.current || upload.current.file !== file) {
        const previousPath = upload.current?.path;
        const compressed = prepared.blob;
        setMessage(
          `사진 업로드 중: ${displaySize(file.size)} → ${displaySize(compressed.size)}`,
        );
        const path = `${groupId}/${userId}/${crypto.randomUUID()}.${PHOTO_EXTENSIONS[compressed.type]}`;
        const { error } = await supabase.storage
          .from("proof-evidence")
          .upload(path, compressed, {
            contentType: compressed.type,
            upsert: false,
          });
        if (error) {
          setMessage(
            "사진 업로드에 실패했습니다. 로그인 상태와 네트워크를 확인해주세요.",
          );
          return;
        }
        upload.current = { file, path, size: compressed.size };
        if (previousPath) {
          // 이미 기록에 연결된 사진은 Storage 정책에서 삭제를 차단합니다.
          await supabase.storage.from("proof-evidence").remove([previousPath]);
        }
      }
      const result = await createPhotoProofAction({
        groupId,
        groupSlug,
        evidencePath: upload.current.path,
        title: String(data.get("title") ?? ""),
        problemUrl,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const storedSize = upload.current.size;
      upload.current = null;
      form.reset();
      setPrepared(null);
      setOpen(false);
      setMessage(
        `사진을 풀이 기록으로 등록했습니다 (${displaySize(file.size)} → ${displaySize(storedSize)}). ${
          result.autoApproved
            ? "바로 인정됐습니다."
            : "검수 승인을 기다려주세요."
        }`,
      );
      router.refresh();
    } catch {
      setMessage(
        "처리 결과를 확인하지 못했습니다. 같은 사진으로 다시 시도해주세요.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">+</span> 풀이 인증하기
      </button>
      {!open && message && (
        <p
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 z-10 w-max max-w-[calc(100%-32px)] -translate-x-1/2 rounded-[10px] border border-line bg-canvas px-4 py-3 text-[15px] shadow-[0_4px_20px_rgba(0,0,0,0.13)]"
        >
          {message}
        </p>
      )}

      <dialog
        ref={dialogRef}
        aria-label="풀이 인증 등록"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current && !busy) setOpen(false);
        }}
        className="m-auto max-h-[calc(100dvh-40px)] w-[min(620px,calc(100%-32px))] overflow-y-auto rounded-[14px] border border-line bg-canvas p-6 text-ink backdrop:bg-black/40"
      >
        <form onSubmit={submit} onPaste={pastePhoto}>
          <div className="flex items-center justify-between gap-3">
            <h3>오늘 푼 문제를 공유해요</h3>
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
            <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sub">
              <label htmlFor="proof-photo" className="text-[15px]">
                풀이 결과가 보이는 사진 한 장
              </label>
              <input
                id="proof-photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                disabled={busy}
                ref={photoInput}
                onChange={(event) => prepare(event.target.files?.[0])}
                className="text-[13px]"
                aria-describedby="photo-help"
              />
              <p id="photo-help" className="text-[13px]">
                복사한 캡처를 붙여넣어도 됩니다 · 20MB까지
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
                    className="max-h-72 w-full rounded-lg bg-soft object-contain"
                  />
                  <span className="mt-1 block text-[13px] text-sub underline">
                    크게 열어 글자 확인
                  </span>
                </a>
              </div>
            )}

            <div className="grid gap-2">
              <label htmlFor="proof-title" className="text-[15px]">
                문제 이름 <span className="text-[13px] text-sub">선택 사항</span>
              </label>
              <input
                id="proof-title"
                name="title"
                maxLength={160}
                disabled={busy}
                placeholder="예: 프로그래머스 더 맵게"
              />
            </div>

            <div className="grid gap-2">
              <label htmlFor="proof-problem-url" className="text-[15px]">
                문제 링크 <span className="text-[13px] text-sub">선택 사항</span>
              </label>
              <input
                id="proof-problem-url"
                name="problemUrl"
                inputMode="url"
                maxLength={MAX_PROBLEM_URL_LENGTH}
                disabled={busy}
                placeholder="https://school.programmers.co.kr/learn/courses/30/lessons/12345"
                aria-describedby="problem-url-help"
              />
              <p id="problem-url-help" className="text-[13px] text-sub">
                프로그래머스, 백준, LeetCode, Codeforces, AtCoder, HackerRank,
                Codewars의 https 주소만 받습니다. 넣으면 다른 멤버가 같은 문제를
                바로 풀어볼 수 있어요.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-sub">
              등록 시각이 기록되고 검수 대기 상태가 됩니다.
            </span>
            <button
              type="submit"
              disabled={busy || preparing || !prepared}
              className="btn btn-primary"
            >
              {busy ? "등록 중…" : "검수 요청하기"}
            </button>
          </div>
          <p role="status" aria-live="polite" className="mt-3 text-[15px]">
            {message}
          </p>
        </form>
      </dialog>
    </>
  );
}
