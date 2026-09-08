import { notFound } from "next/navigation";
import { joinByCodeAction } from "@/app/actions/groups";
import { AppShell } from "@/components/app-shell";
import { GithubSignInButton } from "@/components/github-sign-in-button";
import { StatusMessage } from "@/components/status-message";
import { getOptionalUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";
import { normalizeInviteCode } from "@/lib/proof-input";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function JoinPage({
  params,
  searchParams,
}: PageProps<"/join/[code]">) {
  const code = normalizeInviteCode((await params).code);
  if (!code) notFound();
  const user = await getOptionalUser();
  const query = await searchParams;

  return (
    <AppShell context="초대코드 가입">
      <header className="mb-6">
        <h1>초대코드로 가입하기</h1>
        <p className="mt-[5px] text-[15px] text-sub">
          로그인 후 가입을 신청해주세요. 그룹 소유자가 승인하면 풀이 기록을
          공유할 수 있습니다.
        </p>
      </header>

      <section className="grid max-w-lg gap-4 rounded-xl border border-line bg-soft p-5">
        <div>
          <p className="text-[13px] text-sub">초대코드</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest">
            {code}
          </p>
        </div>
        <StatusMessage error={firstQueryValue(query.error)} />
        {user ? (
          <form action={joinByCodeAction}>
            <input type="hidden" name="code" value={code} />
            <button type="submit" className="btn btn-primary w-full">
              가입 신청
            </button>
          </form>
        ) : (
          <GithubSignInButton
            configured={isSupabaseConfigured()}
            nextPath={`/join/${code}`}
          />
        )}
      </section>
    </AppShell>
  );
}
