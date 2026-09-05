"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPhotoProofAction } from "@/app/actions/proofs";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_SOURCE_PHOTO_BYTES,
  PHOTO_EXTENSIONS,
  photoError,
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState<{
    file: File;
    blob: Blob;
    url: string;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
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
  const upload = useRef<{ file: File; path: string; size: number } | null>(
    null,
  );
  const submitting = useRef(false);

  async function prepare(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const current = ++selection.current;
    setPrepared(null);
    setConfirmed(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const fileInput = form.elements.namedItem("photo") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!(file instanceof File)) return;
    if (preparing || !prepared || prepared.file !== file || !confirmed) {
      setMessage("압축된 사진의 글자를 확인한 후 체크해주세요.");
      return;
    }
    const validationError = photoError(file, MAX_SOURCE_PHOTO_BYTES);
    if (validationError) {
      setMessage(validationError);
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
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      const storedSize = upload.current.size;
      upload.current = null;
      form.reset();
      setPrepared(null);
      setConfirmed(false);
      setMessage(
        `사진을 풀이 기록으로 등록했습니다 (${displaySize(file.size)} → ${displaySize(storedSize)}). 검수 승인을 기다려주세요.`,
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
    <form
      onSubmit={submit}
      className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
    >
      <h2 className="text-xl font-extrabold">사진으로 풀이 등록</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        플랫폼 계정 등록 없이 어느 플랫폼의 사진이든 올릴 수 있습니다. 사진을
        올리면 검수 대기 기록이 생기고, 그룹 소유자나 검수자가 확인합니다.
      </p>
      <label htmlFor="proof-photo" className="mt-5 block text-sm font-bold">
        풀이 인증 사진
      </label>
      <input
        id="proof-photo"
        name="photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        disabled={busy}
        onChange={prepare}
        className="mt-2 w-full rounded-xl border border-[var(--line-strong)] p-3 text-sm"
        aria-describedby="photo-help"
      />
      <p id="photo-help" className="mt-2 text-xs text-[var(--muted)]">
        JPG, PNG, WebP · 원본 최대 20MB · 업로드 전 자동 압축
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
        긴 변 최대 1,920px · 150KB 목표 · 저장 최대 300KB. 글자가 흐리면 필요한
        부분만 잘라 다시 선택해주세요. 기존 사진은 변경하지 않습니다.
      </p>
      {preparing && (
        <p role="status" className="mt-3 text-sm">
          사진 용량을 줄이고 있습니다…
        </p>
      )}
      {prepared && (
        <div className="mt-4">
          <p className="text-sm font-bold">
            저장될 사진: {displaySize(prepared.file.size)} →{" "}
            {displaySize(prepared.blob.size)}
          </p>
          <a
            href={prepared.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block text-sm underline"
          >
            <Image
              src={prepared.url}
              alt="업로드할 압축 사진 미리보기"
              width={640}
              height={480}
              unoptimized
              className="mb-2 max-h-80 w-full rounded-xl object-contain"
            />
            크게 열어 글자 확인
          </a>
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={busy}
              className="mt-1"
            />
            문제명·아이디·통과 결과 등 검수에 필요한 글자가 읽힙니다.
          </label>
        </div>
      )}
      <label htmlFor="proof-title" className="mt-4 block text-sm font-bold">
        제목 (선택)
      </label>
      <input
        id="proof-title"
        name="title"
        maxLength={160}
        disabled={busy}
        placeholder="예: 프로그래머스 두 수의 합"
        className="mt-2 w-full rounded-xl border border-[var(--line-strong)] px-4 py-3"
      />
      <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
        등록 시각이 기록됩니다. 사진 속 문제명·풀이 날짜는 자동으로 추출하지
        않습니다.
      </p>
      <button
        type="submit"
        disabled={busy || preparing || !prepared || !confirmed}
        className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[var(--accent-ink)] disabled:opacity-50"
      >
        {busy ? "등록 중…" : "사진 올리고 검수 요청"}
      </button>
      <p role="status" aria-live="polite" className="mt-3 text-sm">
        {message}
      </p>
    </form>
  );
}
