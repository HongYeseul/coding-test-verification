import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { GithubSignInButton } from "@/components/github-sign-in-button";
import { StatusMessage } from "@/components/status-message";
import { getOptionalUser } from "@/lib/auth";
import { authErrorMessage, safeNextPath } from "@/lib/auth-navigation";
import { firstQueryValue } from "@/lib/form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { GroupDirectory } from "@/lib/public-groups";

function Figure({ children }: { children: number }) {
  return (
    <span className="font-[650] text-ink tabular-nums">{children}</span>
  );
}

const steps = [
  {
    number: "01",
    title: "초대 확인",
    description: "그룹에서 발급한 초대코드나 초대 링크가 있어야 가입합니다.",
  },
  {
    number: "02",
    title: "소유자 승인",
    description: "로그인 후 소유자가 승인하면 그룹 기록이 열립니다.",
  },
  {
    number: "03",
    title: "풀이 인증",
    description: "사진을 올려 풀이를 기록하고 검수자에게 확인받습니다.",
  },
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const configured = isSupabaseConfigured();
  const user = await getOptionalUser();
  const query = await searchParams;
  const next = safeNextPath(firstQueryValue(query.next));

  if (user) {
    redirect(next === "/" ? "/dashboard" : next);
  }

  // 로그인 없이도 어떤 스터디가 굴러가는지 보이도록 목록만 먼저 내려줍니다.
  const { data: directoryData } = configured
    ? await (await createClient()).rpc("get_group_directory")
    : { data: null };
  const directory = directoryData as GroupDirectory | null;
  const groups = directory?.groups ?? [];

  return (
    <AppShell
      actions={<span className="text-[13px] text-sub">초대 전용</span>}
    >
      <header className="mb-6">
        <h1>오늘 푼 문제를 함께 확인합니다.</h1>
        <p className="mt-1 max-w-xl text-[15px] text-sub">
          허가된 멤버만 그룹과 인증 기록을 볼 수 있습니다. GitHub 계정으로
          로그인한 뒤 초대 승인을 받아주세요.
        </p>
      </header>

      <section className="grid gap-5 sm:grid-cols-2">
        <div className="grid content-start gap-3 rounded-xl border border-line bg-soft p-5">
          <h2>GitHub로 로그인</h2>
          <p className="text-[13px] text-sub">
            초대 대상 확인에는 GitHub 계정을 사용합니다.
          </p>
          <div className="mt-2">
            <GithubSignInButton configured={configured} nextPath={next} />
          </div>
          {query.auth_error && (
            <StatusMessage
              error={authErrorMessage(firstQueryValue(query.auth_error))}
            />
          )}
          {!configured && (
            <p className="text-[13px] text-sub">
              현재는 프로젝트 설정 단계입니다. Supabase 연결 후 로그인이
              활성화됩니다.
            </p>
          )}
        </div>

        <div>
          <h2 className="mb-3">그룹이 열리기까지</h2>
          <ol className="rounded-xl border border-line">
            {steps.map((step) => (
              <li
                key={step.number}
                className="grid grid-cols-[2rem_1fr] gap-3 border-b border-line px-4 py-4 last:border-b-0"
              >
                <span className="font-mono text-[13px] text-brand">
                  {step.number}
                </span>
                <div>
                  <p className="text-[15px] font-semibold">{step.title}</p>
                  <p className="mt-1 text-[13px] text-sub">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[12px] text-sub">
            모든 풀이 인증은 그룹 소유자나 검수자가 사진으로 확인합니다.
          </p>
        </div>
      </section>

      <section aria-labelledby="group-directory-title" className="mt-7">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="group-directory-title">함께 풀고 있는 스터디</h2>
          {directory && groups.length > 0 && (
            <p className="text-[13px] text-sub">
              스터디 <Figure>{groups.length}</Figure>개 · 멤버{" "}
              <Figure>{directory.totalMembers}</Figure>명
              {directory.weekApproved > 0 && (
                <>
                  {" · "}이번 주 인증{" "}
                  <Figure>{directory.weekApproved}</Figure>번
                </>
              )}
            </p>
          )}
        </div>

        {groups.length ? (
          <ul className="rounded-xl border border-line">
            {groups.map((group) => {
              const row = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-semibold group-hover/row:underline">
                      {group.name}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-sub tabular-nums">
                      멤버 {group.memberCount}명
                    </span>
                  </span>
                  {group.days ? (
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      {/* 그룹 화면의 주간 인증 매트릭스를 한 줄로 줄인 모양입니다. */}
                      <span aria-hidden="true" className="flex gap-1">
                        {group.days.map((day) => (
                          <span
                            key={day.date}
                            className={`h-3.5 w-2.5 rounded-[2px] border ${
                              day.approved > 0
                                ? "border-brand bg-brand"
                                : "border-line bg-soft"
                            } ${
                              directory && day.date > directory.today
                                ? "opacity-40"
                                : ""
                            }`}
                          />
                        ))}
                      </span>
                      <span className="text-[12px] text-sub tabular-nums">
                        {group.weekApproved
                          ? `이번 주 ${group.weekApproved}번`
                          : "이번 주 아직 없음"}
                      </span>
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[12px] text-sub">
                      비공개
                    </span>
                  )}
                </>
              );
              return (
                <li
                  key={group.slug}
                  className="border-b border-line last:border-b-0"
                >
                  {group.isPublic ? (
                    <Link
                      href={`/open/${group.slug}`}
                      className="group/row flex items-center justify-between gap-4 px-4 py-3 hover:bg-soft"
                    >
                      {row}
                    </Link>
                  ) : (
                    <span className="flex items-center justify-between gap-4 px-4 py-3">
                      {row}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-line px-5 py-10 text-center text-[13px] text-sub">
            아직 열린 스터디가 없습니다. 로그인하면 새 스터디를 만들 수 있어요.
          </p>
        )}
      </section>
    </AppShell>
  );
}
