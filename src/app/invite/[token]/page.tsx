import { notFound } from "next/navigation";

import { signOutAction } from "@/app/actions/auth";
import { acceptInvitationAction } from "@/app/actions/groups";
import { AppShell } from "@/components/app-shell";
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
    <AppShell context="그룹 초대">
      <header className="mb-6">
        <h1>스터디 초대가 도착했습니다.</h1>
        <p className="mt-1 max-w-xl text-[15px] text-sub">
          초대 대상 GitHub 계정으로 로그인하고 초대를 수락해주세요. 수락 후 그룹
          소유자가 가입을 승인하면 기록을 볼 수 있습니다.
        </p>
      </header>

      <section className="grid max-w-lg gap-4 rounded-xl border border-line bg-soft p-5">
        <StatusMessage error={firstQueryValue(query.error)} />

        {!configured && (
          <p className="text-[15px] text-warn">
            Supabase 연결 후 초대를 수락할 수 있습니다.
          </p>
        )}

        {configured && !user && (
          <GithubSignInButton configured nextPath={invitationPath} />
        )}

        {user && (
          <>
            <form action={acceptInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <p className="mb-3 text-[13px] text-sub">
                <strong className="font-semibold text-ink">
                  {user.user_metadata.user_name ?? user.email ?? "현재 계정"}
                </strong>
                으로 로그인했습니다.
              </p>
              <button type="submit" className="btn btn-primary w-full">
                초대 수락
              </button>
            </form>
            <form action={signOutAction}>
              <input type="hidden" name="next" value={invitationPath} />
              <button type="submit" className="text-[13px] text-sub underline">
                로그아웃하고 다른 GitHub 계정으로 계속하기
              </button>
            </form>
          </>
        )}
      </section>
    </AppShell>
  );
}
