import Link from "next/link";

import { signOutAction } from "@/app/actions/auth";
import { createGroupAction } from "@/app/actions/groups";
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
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-5 shadow-sm">
          <div>
            <p className="font-mono text-xs font-bold tracking-[0.14em] text-[var(--accent-strong)]">
              CODING PROOF
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.03em]">
              {profile?.display_name ?? "멤버"}님의 그룹
            </h1>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-xl border border-[var(--line-strong)] px-4 py-2 text-sm font-bold text-[var(--muted-strong)] hover:bg-[var(--surface-subtle)]"
            >
              로그아웃
            </button>
          </form>
        </header>

        <StatusMessage
          error={firstQueryValue(query.error)}
          message={firstQueryValue(query.message)}
        />

        {pendingCount > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800">
            가입 승인 대기 중인 그룹이 {pendingCount}개 있습니다.
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">활성 그룹</p>
                <h2 className="mt-1 text-xl font-extrabold">함께 푸는 공간</h2>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-xs font-bold text-[var(--accent-ink)]">
                {groups.length} GROUPS
              </span>
            </div>

            {groups.length ? (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {groups.map((group) => {
                  const membership = membershipByGroupId.get(group.id);
                  return (
                    <li key={group.id}>
                      <Link
                        href={`/groups/${group.slug}`}
                        className="block rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--line-strong)]"
                      >
                        <p className="font-bold">{group.name}</p>
                        <p className="mt-2 font-mono text-xs text-[var(--muted)]">
                          /{group.slug} · {membership?.role ?? "MEMBER"}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl bg-[var(--surface-subtle)] px-5 py-8 text-center text-sm text-[var(--muted)]">
                아직 활성 그룹이 없습니다. 새 그룹을 만들거나 초대 링크를
                받아주세요.
              </p>
            )}
          </div>

          <form
            action={createGroupAction}
            className="rounded-3xl border border-[var(--line)] bg-[var(--ink)] p-6 text-white shadow-sm"
          >
            <p className="font-mono text-xs font-bold tracking-[0.14em] text-[var(--accent)]">
              NEW GROUP
            </p>
            <h2 className="mt-2 text-xl font-extrabold">스터디 그룹 만들기</h2>
            <label className="mt-5 block text-sm font-semibold" htmlFor="name">
              그룹 이름
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={60}
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/45"
              placeholder="알고리즘 스터디"
            />
            <label className="mt-4 block text-sm font-semibold" htmlFor="slug">
              그룹 주소
            </label>
            <input
              id="slug"
              name="slug"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 font-mono text-white placeholder:text-white/45"
              placeholder="algorithm-study"
            />
            <button
              type="submit"
              className="mt-5 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[var(--accent-ink)] hover:bg-[#d0fa86]"
            >
              그룹 만들기
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
