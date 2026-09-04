import { redirect } from "next/navigation";

import { GithubSignInButton } from "@/components/github-sign-in-button";
import { StatusMessage } from "@/components/status-message";
import { getOptionalUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const steps = [
  {
    number: "01",
    title: "초대 확인",
    description: "그룹에서 발급한 초대가 있어야 가입할 수 있습니다.",
  },
  {
    number: "02",
    title: "관리자 승인",
    description: "로그인 후 관리자가 확인하면 그룹 기록이 열립니다.",
  },
  {
    number: "03",
    title: "풀이 인증",
    description: "공식 API 또는 검수된 증빙으로 AC 기록을 남깁니다.",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const configured = isSupabaseConfigured();
  const user = await getOptionalUser();
  const query = await searchParams;

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 text-[var(--foreground)] sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] font-mono text-sm font-bold text-[var(--accent)]">
              AC
            </span>
            <div>
              <p className="text-base font-bold tracking-[-0.02em]">Coding Proof</p>
              <p className="text-sm text-[var(--muted)]">Private study group</p>
            </div>
          </div>
          <span className="rounded-full border border-[var(--line-strong)] px-3 py-1.5 text-sm font-semibold text-[var(--muted-strong)]">
            초대 전용
          </span>
        </header>

        <section className="grid flex-1 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col justify-center border-b border-[var(--line)] px-6 py-14 sm:px-10 lg:border-r lg:border-b-0 lg:px-14 lg:py-16">
            <p className="mb-5 font-mono text-sm font-bold tracking-[0.14em] text-[var(--accent-strong)]">
              MEMBERS ONLY
            </p>
            <h1 className="max-w-xl text-4xl leading-[1.15] font-black tracking-[-0.045em] text-balance sm:text-5xl">
              오늘 푼 문제를
              <br />
              함께 확인합니다.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-[var(--muted-strong)] sm:text-lg">
              허가된 멤버만 그룹과 인증 기록을 볼 수 있습니다. GitHub 계정으로
              로그인한 뒤 초대 승인을 받아주세요.
            </p>

            <div className="mt-9 max-w-sm">
              <GithubSignInButton configured={configured} />
              {query.auth_error && (
                <div className="mt-3">
                  <StatusMessage error="GitHub 로그인을 완료하지 못했습니다." />
                </div>
              )}
              {!configured && (
                <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                  현재는 프로젝트 설정 단계입니다. Supabase 연결 후 로그인이
                  활성화됩니다.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center bg-[var(--surface-subtle)] px-6 py-12 sm:px-10 lg:px-12">
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">가입 절차</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.03em]">
                  그룹이 열리기까지
                </h2>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 font-mono text-xs font-bold text-[var(--accent-ink)]">
                3 STEPS
              </span>
            </div>

            <ol className="space-y-3">
              {steps.map((step) => (
                <li
                  key={step.number}
                  className="grid grid-cols-[3.25rem_1fr] gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5"
                >
                  <span className="font-mono text-sm font-bold text-[var(--accent-strong)]">
                    {step.number}
                  </span>
                  <div>
                    <h3 className="font-bold tracking-[-0.01em]">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[var(--ink)] px-5 py-4 text-sm text-white">
              <span className="size-2.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_0_5px_rgba(190,242,100,0.12)]" />
              <p>현재 모든 플랫폼 제출은 그룹 검수자가 확인합니다.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
