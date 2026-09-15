import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReleaseEntry } from "@/components/release-notes";
import { GITHUB_RELEASE_URL, RELEASES } from "@/lib/release-notes";

export const metadata: Metadata = {
  title: "릴리스 노트",
  description: "도장이 그동안 어떻게 달라졌는지 모은 기록입니다.",
};

/**
 * 지난 기록. 첫 화면과 대시보드의 카드는 웹과 확장 각각 최신 하나씩만 보여주므로
 * 전부를 볼 자리가 따로 필요합니다. 로그인 없이 봅니다 — 들어오기 전에도 이 서비스가
 * 어떻게 굴러왔는지 보여야 합니다.
 */
export default function Releases() {
  return (
    <AppShell
      context="릴리스 노트"
      actions={
        <Link href="/" className="text-[13px] text-sub">
          첫 화면
        </Link>
      }
    >
      <header className="mb-6">
        <h1>릴리스 노트</h1>
      </header>

      <ol className="grid gap-4">
        {RELEASES.map((release) => (
          <li
            key={`${release.surface}-${release.date}`}
            className="grid content-start rounded-surface border border-line bg-surface px-5 py-4"
          >
            <ReleaseEntry release={release} />
          </li>
        ))}
      </ol>

      <p className="mt-5 text-[13px] text-sub">
        이전 버전 확장은{" "}
        <a
          href={GITHUB_RELEASE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-ink"
        >
          GitHub 릴리스
        </a>
        에서 받을 수 있습니다.
      </p>
    </AppShell>
  );
}
