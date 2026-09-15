import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReleaseEntry } from "@/components/release-notes";
import { GITHUB_RELEASE_URL, RELEASES } from "@/lib/release-notes";

export const metadata: Metadata = {
  title: "릴리스 노트",
  description: "도장의 웹과 크롬 확장이 언제 무엇이 달라졌는지 모아둔 기록입니다.",
};

/**
 * 지난 기록. 카드는 면마다 최신 하나씩만 보여주므로 전부를 볼 자리가 따로 필요합니다.
 * 로그인 없이 봅니다 — 들어오기 전에도 이 서비스가 어떻게 굴러왔는지 보여야 합니다.
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
        <p className="mt-1 max-w-2xl text-[15px] text-sub">
          웹과 크롬 확장이 언제 무엇이 달라졌는지 모았습니다. 웹은 계속 배포해
          번호 대신 날짜로 가르고, 확장은 받아서 바꿔 끼우는 것이라 번호로
          가릅니다.
        </p>
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
        확장의 더 지난 버전과 내려받을 파일은{" "}
        <a
          href={GITHUB_RELEASE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-ink"
        >
          GitHub 릴리스
        </a>
        에 있습니다.
      </p>
    </AppShell>
  );
}
