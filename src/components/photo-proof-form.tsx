"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPhotoProofAction } from "@/app/actions/proofs";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_EXTENSIONS, photoError } from "@/lib/proof-input";

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
  const upload = useRef<{ file: File; path: string } | null>(null);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const fileInput = form.elements.namedItem("photo") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!(file instanceof File)) return;
    const validationError = photoError(file);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    submitting.current = true;
    setBusy(true);
    setMessage("사진을 업로드하고 있습니다.");
    try {
      const supabase = createClient();
      if (!upload.current || upload.current.file !== file) {
        const previousPath = upload.current?.path;
        const path = `${groupId}/${userId}/${crypto.randomUUID()}.${PHOTO_EXTENSIONS[file.type]}`;
        const { error } = await supabase.storage
          .from("proof-evidence")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (error) {
          setMessage(
            "사진 업로드에 실패했습니다. 로그인 상태와 네트워크를 확인해주세요.",
          );
          return;
        }
        upload.current = { file, path };
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
      upload.current = null;
      form.reset();
      setMessage(
        "사진을 풀이 기록으로 등록했습니다. 검수 승인을 기다려주세요.",
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
        className="mt-2 w-full rounded-xl border border-[var(--line-strong)] p-3 text-sm"
        aria-describedby="photo-help"
      />
      <p id="photo-help" className="mt-2 text-xs text-[var(--muted)]">
        JPG, PNG, WebP · 최대 6MB · 문제와 풀이 결과가 보이는 사진
      </p>
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
        disabled={busy}
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
