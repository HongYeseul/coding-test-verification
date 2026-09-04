import Link from "next/link";
import { notFound } from "next/navigation";
import { joinByCodeAction } from "@/app/actions/groups";
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
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10">
      <section className="w-full max-w-lg space-y-5 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8">
        <Link href="/dashboard" className="text-sm font-bold">
          ← 그룹 목록
        </Link>
        <h1 className="text-3xl font-black">초대코드로 가입하기</h1>
        <p className="font-mono text-4xl font-bold tracking-widest">{code}</p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          로그인 후 가입을 신청해주세요. 그룹 소유자가 승인하면 풀이 기록을
          공유할 수 있습니다.
        </p>
        <StatusMessage error={firstQueryValue(query.error)} />
        {user ? (
          <form action={joinByCodeAction}>
            <input type="hidden" name="code" value={code} />
            <button className="w-full rounded-xl bg-[var(--accent)] p-3 font-bold">
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
    </main>
  );
}
