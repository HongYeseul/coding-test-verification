import Link from "next/link";

import { signOutAction } from "@/app/actions/auth";
import { createGroupAction, joinByCodeAction } from "@/app/actions/groups";
import { AppShell } from "@/components/app-shell";
import { StatusMessage } from "@/components/status-message";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";

type MembershipRow = {
  group_id: string;
  role: "OWNER" | "REVIEWER" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "REVOKED";
};

type GroupRow = {
  id: string;
  name: string;
  slug: string;
};

const roleLabels: Record<string, string> = {
  OWNER: "소유자",
  REVIEWER: "검수자",
  MEMBER: "멤버",
};

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const { supabase, user } = await requireUser();
  const query = await searchParams;
  const [{ data: profile }, { data: membershipData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("group_members")
      .select("group_id, role, status")
      .eq("user_id", user.id),
  ]);

  const memberships = (membershipData ?? []) as MembershipRow[];
  const activeMemberships = memberships.filter(
    (membership) => membership.status === "ACTIVE",
  );
  const activeGroupIds = activeMemberships.map(
    (membership) => membership.group_id,
  );
  const { data: groupData } = activeGroupIds.length
    ? await supabase
        .from("groups")
        .select("id, name, slug")
        .in("id", activeGroupIds)
        .order("name")
    : { data: [] };
  const groups = (groupData ?? []) as GroupRow[];
  const membershipByGroupId = new Map(
    activeMemberships.map((membership) => [membership.group_id, membership]),
  );
  const pendingCount = memberships.filter(
    (membership) => membership.status === "PENDING",
  ).length;

  return (
    <AppShell
      actions={
        <div className="flex items-center gap-3">
          <Link href="/settings/profile" className="text-[13px] text-sub">
            프로필
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="text-[13px] text-sub">
              로그아웃
            </button>
          </form>
        </div>
      }
    >
      <header className="mb-6">
        <h1>{profile?.display_name ?? "멤버"}님의 그룹</h1>
        <p className="mt-1 text-[15px] text-sub">
          활성 그룹 {groups.length}개
          {pendingCount > 0 ? ` · 가입 승인 대기 ${pendingCount}개` : ""}
        </p>
      </header>

      <div className="mb-5 empty:mb-0">
        <StatusMessage
          error={firstQueryValue(query.error)}
          message={firstQueryValue(query.message)}
        />
      </div>

      <section aria-label="참여 중인 그룹" className="mb-7">
        {groups.length ? (
          <ul className="rounded-xl border border-line">
            {groups.map((group) => {
              const membership = membershipByGroupId.get(group.id);
              return (
                <li key={group.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/groups/${group.slug}`}
                    className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-soft"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {group.name}
                      </span>
                      <span className="mt-1 block truncate text-[13px] text-sub">
                        /{group.slug} ·{" "}
                        {roleLabels[membership?.role ?? "MEMBER"] ?? "멤버"}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-[13px] text-sub">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex min-h-[180px] flex-col justify-center rounded-xl border border-line px-4 py-8 text-center text-sub">
            <strong className="mb-1 block text-[17px] font-semibold text-ink">
              아직 참여 중인 그룹이 없어요
            </strong>
            <span className="text-[13px]">
              초대코드로 가입하거나 새 그룹을 만들어보세요.
            </span>
          </div>
        )}
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <form
          action={joinByCodeAction}
          className="grid gap-2 rounded-xl border border-line bg-soft p-5"
        >
          <h2>초대코드로 가입</h2>
          <p className="text-[13px] text-sub">
            받은 5자리 코드를 넣으면 가입을 신청합니다. 소유자가 승인해야 기록을
            볼 수 있어요.
          </p>
          <label htmlFor="invite-code" className="mt-2 text-[15px]">
            초대코드
          </label>
          <input
            id="invite-code"
            name="code"
            required
            minLength={5}
            maxLength={5}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="5자리 코드"
            className="font-mono tracking-widest uppercase"
          />
          <button type="submit" className="btn mt-2 justify-self-start">
            가입 신청
          </button>
        </form>

        <form
          action={createGroupAction}
          className="grid gap-2 rounded-xl border border-line bg-soft p-5"
        >
          <h2>스터디 그룹 만들기</h2>
          <p className="text-[13px] text-sub">
            그룹을 만들면 소유자가 되어 초대코드를 발급하고 인증을 검수합니다.
          </p>
          <label htmlFor="name" className="mt-2 text-[15px]">
            그룹 이름
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={60}
            placeholder="알고리즘 스터디"
          />
          <label htmlFor="slug" className="mt-1 text-[15px]">
            그룹 주소
          </label>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="algorithm-study"
            className="font-mono"
          />
          <button type="submit" className="btn btn-primary mt-2 justify-self-start">
            그룹 만들기
          </button>
        </form>
      </section>
    </AppShell>
  );
}
