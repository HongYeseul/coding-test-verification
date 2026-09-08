import Link from "next/link";

import { updateProfileAction } from "@/app/actions/profile";
import { AppShell } from "@/components/app-shell";
import { StatusMessage } from "@/components/status-message";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";
import {
  githubHandle,
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
} from "@/lib/profile";

type ProfileRow = {
  display_name: string;
  bio: string | null;
  github_login: string | null;
};

export default async function ProfileSettingsPage({
  searchParams,
}: PageProps<"/settings/profile">) {
  const { supabase, user } = await requireUser("/settings/profile");
  const query = await searchParams;
  const { data } = await supabase
    .from("profiles")
    .select("display_name, bio, github_login")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as ProfileRow | null;
  const handle = githubHandle(profile?.github_login);

  return (
    <AppShell
      context="프로필"
      actions={
        <Link href="/dashboard" className="text-[13px] text-sub">
          그룹 목록
        </Link>
      }
    >
      <header className="mb-6">
        <h1>프로필</h1>
        <p className="mt-[5px] text-[15px] text-sub">
          여기서 정한 닉네임과 소개가 함께 있는 그룹의 멤버에게 보입니다.
        </p>
      </header>

      <div className="mb-5 empty:mb-0">
        <StatusMessage
          error={firstQueryValue(query.error)}
          message={firstQueryValue(query.message)}
        />
      </div>

      <form
        action={updateProfileAction}
        className="grid gap-[7px] rounded-xl border border-line p-5 sm:max-w-[520px]"
      >
        <label htmlFor="displayName" className="text-[15px]">
          닉네임
        </label>
        <input
          id="displayName"
          name="displayName"
          required
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          autoComplete="nickname"
          defaultValue={profile?.display_name ?? ""}
          placeholder="그룹에서 보일 이름"
        />
        <p className="text-[13px] text-sub">
          {MAX_DISPLAY_NAME_LENGTH}자까지 쓸 수 있습니다. 주간 현황과 풀이
          기록에 이 이름이 나옵니다.
        </p>

        <label htmlFor="bio" className="mt-3 text-[15px]">
          한 줄 소개
        </label>
        <input
          id="bio"
          name="bio"
          maxLength={MAX_BIO_LENGTH}
          defaultValue={profile?.bio ?? ""}
          placeholder="매일 한 문제씩 풀고 있어요"
        />
        <p className="text-[13px] text-sub">
          비워둘 수 있고 {MAX_BIO_LENGTH}자까지 쓸 수 있습니다.
        </p>

        <button type="submit" className="btn btn-primary mt-4 justify-self-start">
          저장
        </button>
      </form>

      <section aria-label="연결된 계정" className="mt-5 sm:max-w-[520px]">
        <h2>연결된 계정</h2>
        <p className="mt-2 rounded-xl border border-line bg-soft px-4 py-3 text-[15px]">
          GitHub{" "}
          {handle ? (
            <span className="font-mono">@{handle}</span>
          ) : (
            <span className="text-sub">연결 정보를 불러오지 못했습니다.</span>
          )}
        </p>
        <p className="mt-2 text-[13px] text-sub">
          닉네임을 바꿔도 누구인지 확인할 수 있도록 가입 승인과 멤버 관리
          화면에는 GitHub 아이디가 함께 보입니다. 이 값은 로그인한 GitHub
          계정에서 가져오며 직접 바꿀 수 없습니다.
        </p>
      </section>
    </AppShell>
  );
}
