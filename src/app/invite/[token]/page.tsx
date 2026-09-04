import Link from "next/link";
import { notFound } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { acceptInvitationAction } from "@/app/actions/groups";
import { GithubSignInButton } from "@/components/github-sign-in-button";
import { StatusMessage } from "@/components/status-message";
import { getOptionalUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function InvitationPage({
  params,
  searchParams,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) notFound();
  const query = await searchParams;
  const configured = isSupabaseConfigured();
  const user = await getOptionalUser();
  const invitationPath = `/invite/${token}`;

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[0_30px_80px_rgba(15,23,42,0.12)] sm:p-9">
        <Link
          href="/"
          className="font-mono text-sm font-bold text-[var(--accent-strong)]"
        >
          CODING PROOF
        </Link>
        <p className="mt-8 font-mono text-xs font-bold tracking-[0.14em] text-[var(--muted)]">
          GROUP INVITATION
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
          스터디 초대가 도착했습니다.
        </h1>
        <p className="mt-4 leading-7 text-[var(--muted-strong)]">
          초대 대상 GitHub 계정으로 로그인하고 초대를 수락해주세요. 수락 후 그룹
          소유자가 가입을 승인하면 기록을 볼 수 있습니다.
        </p>

        <div className="mt-6">
          <StatusMessage error={firstQueryValue(query.error)} />
        </div>

        {!configured && (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Supabase 연결 후 초대를 수락할 수 있습니다.
          </p>
        )}

        {configured && !user && (
          <div className="mt-7">
            <GithubSignInButton configured nextPath={invitationPath} />
          </div>
        )}

        {user && (
          <>
            <form action={acceptInvitationAction} className="mt-7">
              <input type="hidden" name="token" value={token} />
              <p className="mb-3 text-sm text-[var(--muted)]">
                <strong className="text-[var(--foreground)]">
                  {user.user_metadata.user_name ?? user.email ?? "현재 계정"}
                </strong>
                으로 로그인했습니다.
              </p>
              <button
                type="submit"
                className="w-full rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[var(--accent-ink)] hover:bg-[#d0fa86]"
              >
                초대 수락
              </button>
            </form>
            <form action={signOutAction} className="mt-4">
              <input type="hidden" name="next" value={invitationPath} />
              <button
                type="submit"
                className="text-sm font-bold text-[var(--accent-strong)]"
              >
                로그아웃하고 다른 GitHub 계정으로 계속하기
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
