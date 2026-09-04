import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  approveMembershipAction,
  createInvitationAction,
  setMemberRoleAction,
} from "@/app/actions/groups";
import {
  createPlatformAccountAction,
  createProofAction,
  deleteProofAction,
  reviewProofAction,
} from "@/app/actions/proofs";
import { StatusMessage } from "@/components/status-message";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";

type MembershipRow = {
  user_id: string;
  role: "OWNER" | "REVIEWER" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "REVOKED";
  joined_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
};

type PlatformAccountRow = {
  id: string;
  user_id: string;
  platform: string;
  handle: string;
  verification_status: string;
};

type ProofRow = {
  id: string;
  user_id: string;
  platform_account_id: string;
  problem_key: string;
  problem_url: string;
  problem_title: string | null;
  accepted_at: string;
  verification_status: string;
};

type ReviewRow = {
  proof_id: string;
  decision: string;
  note: string | null;
};

const platformLabels: Record<string, string> = {
  CODEFORCES: "Codeforces",
  PROGRAMMERS: "프로그래머스",
  LEETCODE: "LeetCode",
  ATCODER: "AtCoder",
  HACKERRANK: "HackerRank",
  CODEWARS: "Codewars",
};

const proofStatusLabels: Record<string, string> = {
  PENDING: "검수 대기",
  MANUAL_REVIEWED: "승인",
  API_VERIFIED: "자동 확인",
  REJECTED: "반려",
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export default async function GroupPage({
  params,
  searchParams,
}: PageProps<"/groups/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser(`/groups/${slug}`);
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, slug, owner_id")
    .eq("slug", slug)
    .maybeSingle();

  if (!group) {
    notFound();
  }

  const { data: currentMembership } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", group.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (currentMembership?.status !== "ACTIVE") {
    redirect("/dashboard");
  }

  const [{ data: membershipData }, { data: accountData }, { data: proofData }] =
    await Promise.all([
      supabase
        .from("group_members")
        .select("user_id, role, status, joined_at")
        .eq("group_id", group.id)
        .neq("status", "REVOKED")
        .order("created_at"),
      supabase
        .from("platform_accounts")
        .select("id, user_id, platform, handle, verification_status")
        .order("created_at"),
      supabase
        .from("proofs")
        .select(
          "id, user_id, platform_account_id, problem_key, problem_url, problem_title, accepted_at, verification_status",
        )
        .eq("group_id", group.id)
        .order("accepted_at", { ascending: false })
        .limit(50),
    ]);

  const memberships = (membershipData ?? []) as MembershipRow[];
  const accounts = (accountData ?? []) as PlatformAccountRow[];
  const proofs = (proofData ?? []) as ProofRow[];
  const memberIds = memberships.map((membership) => membership.user_id);
  const proofIds = proofs.map((proof) => proof.id);
  const [{ data: profileData }, { data: reviewData }] = await Promise.all([
    memberIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", memberIds)
      : Promise.resolve({ data: [] }),
    proofIds.length
      ? supabase
          .from("proof_reviews")
          .select("proof_id, decision, note")
          .in("proof_id", proofIds)
      : Promise.resolve({ data: [] }),
  ]);
  const profiles = (profileData ?? []) as ProfileRow[];
  const reviews = (reviewData ?? []) as ReviewRow[];
  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile.display_name]),
  );
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const reviewByProofId = new Map(
    reviews.map((review) => [review.proof_id, review]),
  );
  const currentUserAccounts = accounts.filter(
    (account) => account.user_id === user.id,
  );
  const canReview = ["OWNER", "REVIEWER"].includes(currentMembership.role);
  const isOwner = currentMembership.role === "OWNER";
  const invitationPath = firstQueryValue(query.invite);

  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-6 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] px-6 py-5 shadow-sm">
          <Link
            href="/dashboard"
            className="text-sm font-bold text-[var(--accent-strong)]"
          >
            ← 그룹 목록
          </Link>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-xs font-bold tracking-[0.14em] text-[var(--muted)]">
                /{group.slug}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">
                {group.name}
              </h1>
            </div>
            <span className="rounded-full bg-[var(--ink)] px-3 py-1.5 font-mono text-xs font-bold text-[var(--accent)]">
              {currentMembership.role}
            </span>
          </div>
        </header>

        <StatusMessage
          error={firstQueryValue(query.error)}
          message={firstQueryValue(query.message)}
        />

        {invitationPath && (
          <section className="rounded-2xl border border-lime-300 bg-lime-50 p-5">
            <p className="font-bold text-lime-900">
              7일 동안 사용할 초대 링크입니다.
            </p>
            <code className="mt-3 block overflow-x-auto rounded-xl bg-white px-4 py-3 text-sm text-lime-900">
              {invitationPath}
            </code>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold">멤버</h2>
              <span className="font-mono text-xs font-bold text-[var(--muted)]">
                {memberships.length}
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {memberships.map((membership) => (
                <li
                  key={membership.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface-subtle)] px-4 py-3"
                >
                  <div>
                    <p className="font-bold">
                      {profileById.get(membership.user_id) ??
                        `멤버 ${membership.user_id.slice(0, 8)}`}
                    </p>
                    <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                      {membership.role} · {membership.status}
                    </p>
                  </div>
                  {isOwner && membership.status === "PENDING" && (
                    <form action={approveMembershipAction}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input
                        type="hidden"
                        name="groupSlug"
                        value={group.slug}
                      />
                      <input
                        type="hidden"
                        name="userId"
                        value={membership.user_id}
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-[var(--ink)] px-3 py-2 text-sm font-bold text-white"
                      >
                        가입 승인
                      </button>
                    </form>
                  )}
                  {isOwner &&
                    membership.status === "ACTIVE" &&
                    membership.role !== "OWNER" && (
                      <form action={setMemberRoleAction} className="flex gap-2">
                        <input type="hidden" name="groupId" value={group.id} />
                        <input
                          type="hidden"
                          name="groupSlug"
                          value={group.slug}
                        />
                        <input
                          type="hidden"
                          name="userId"
                          value={membership.user_id}
                        />
                        <select
                          name="role"
                          aria-label="멤버 역할"
                          defaultValue={membership.role}
                          className="rounded-xl border border-[var(--line-strong)] bg-white px-3 py-2 text-sm"
                        >
                          <option value="MEMBER">멤버</option>
                          <option value="REVIEWER">검수자</option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-xl bg-[var(--ink)] px-3 py-2 text-sm font-bold text-white"
                        >
                          역할 변경
                        </button>
                      </form>
                    )}
                </li>
              ))}
            </ul>
          </div>

          {isOwner && (
            <form
              action={createInvitationAction}
              className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
            >
              <h2 className="text-xl font-extrabold">멤버 초대</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                이메일 또는 GitHub 아이디에 묶인 일회용 링크를 만듭니다.
              </p>
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="groupSlug" value={group.slug} />
              <div className="mt-5 grid grid-cols-[8rem_1fr] gap-3">
                <select
                  name="targetType"
                  className="rounded-xl border border-[var(--line-strong)] bg-white px-3 py-3 text-sm font-semibold"
                >
                  <option value="github">GitHub ID</option>
                  <option value="email">이메일</option>
                </select>
                <input
                  name="target"
                  required
                  className="min-w-0 rounded-xl border border-[var(--line-strong)] px-4 py-3"
                  placeholder="octocat"
                />
              </div>
              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[var(--accent-ink)]"
              >
                초대 링크 만들기
              </button>
            </form>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-6">
            <form
              action={createPlatformAccountAction}
              className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
            >
              <h2 className="text-xl font-extrabold">내 플랫폼 계정</h2>
              <input type="hidden" name="groupSlug" value={group.slug} />
              <select
                name="platform"
                className="mt-5 w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3"
              >
                {Object.entries(platformLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <input
                name="handle"
                required
                maxLength={100}
                className="mt-3 w-full rounded-xl border border-[var(--line-strong)] px-4 py-3"
                placeholder="플랫폼 계정명"
              />
              <button
                type="submit"
                className="mt-3 w-full rounded-xl bg-[var(--ink)] px-4 py-3 font-bold text-white"
              >
                계정 등록
              </button>
              {currentUserAccounts.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
                  {currentUserAccounts.map((account) => (
                    <li key={account.id} className="text-sm">
                      <strong>{platformLabels[account.platform]}</strong>
                      <span className="ml-2 text-[var(--muted)]">
                        {account.handle}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </form>

            <form
              action={createProofAction}
              className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
            >
              <h2 className="text-xl font-extrabold">풀이 등록</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                현재는 모든 플랫폼의 제출을 그룹 검수자가 확인합니다.
              </p>
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="groupSlug" value={group.slug} />
              <select
                name="platformAccountId"
                required
                disabled={!currentUserAccounts.length}
                className="mt-5 w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 py-3 disabled:bg-slate-100"
              >
                <option value="">플랫폼 계정 선택</option>
                {currentUserAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {platformLabels[account.platform]} · {account.handle}
                  </option>
                ))}
              </select>
              <input
                name="problemKey"
                required
                maxLength={160}
                className="mt-3 w-full rounded-xl border border-[var(--line-strong)] px-4 py-3"
                placeholder="문제 식별자 (예: 1857-A)"
              />
              <input
                name="problemTitle"
                maxLength={160}
                className="mt-3 w-full rounded-xl border border-[var(--line-strong)] px-4 py-3"
                placeholder="문제 제목 (선택)"
              />
              <input
                name="problemUrl"
                type="url"
                required
                className="mt-3 w-full rounded-xl border border-[var(--line-strong)] px-4 py-3"
                placeholder="https://..."
              />
              <label
                className="mt-3 block text-sm font-semibold"
                htmlFor="acceptedAt"
              >
                풀이 완료 시각 (한국 시간)
              </label>
              <input
                id="acceptedAt"
                name="acceptedAt"
                type="datetime-local"
                required
                className="mt-2 w-full rounded-xl border border-[var(--line-strong)] px-4 py-3"
              />
              <button
                type="submit"
                disabled={!currentUserAccounts.length}
                className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[var(--accent-ink)] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              >
                검수 요청
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  최근 50개
                </p>
                <h2 className="mt-1 text-xl font-extrabold">풀이 기록</h2>
              </div>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-mono text-xs font-bold text-[var(--accent-ink)]">
                {proofs.length} PROOFS
              </span>
            </div>

            {proofs.length ? (
              <ul className="mt-5 space-y-4">
                {proofs.map((proof) => {
                  const account = accountById.get(proof.platform_account_id);
                  const review = reviewByProofId.get(proof.id);
                  const reviewable =
                    canReview &&
                    proof.user_id !== user.id &&
                    proof.verification_status === "PENDING";
                  return (
                    <li
                      key={proof.id}
                      className="rounded-2xl border border-[var(--line)] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <a
                            href={proof.problem_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold hover:text-[var(--accent-strong)]"
                          >
                            {proof.problem_title || proof.problem_key}
                          </a>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {profileById.get(proof.user_id) ?? "멤버"} ·{" "}
                            {account
                              ? `${platformLabels[account.platform]} ${account.handle}`
                              : "플랫폼 계정"}
                          </p>
                          <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                            {displayDate(proof.accepted_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-bold">
                          {proofStatusLabels[proof.verification_status] ??
                            proof.verification_status}
                        </span>
                      </div>

                      {review && (
                        <p className="mt-3 rounded-xl bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--muted-strong)]">
                          {review.decision === "APPROVED" ? "승인" : "반려"}
                          {review.note ? ` · ${review.note}` : ""}
                        </p>
                      )}

                      {reviewable && (
                        <form
                          action={reviewProofAction}
                          className="mt-4 border-t border-[var(--line)] pt-4"
                        >
                          <input
                            type="hidden"
                            name="proofId"
                            value={proof.id}
                          />
                          <input
                            type="hidden"
                            name="groupSlug"
                            value={group.slug}
                          />
                          <textarea
                            name="note"
                            maxLength={500}
                            rows={2}
                            className="w-full rounded-xl border border-[var(--line-strong)] px-4 py-3 text-sm"
                            placeholder="검수 메모 (선택)"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="submit"
                              name="decision"
                              value="APPROVED"
                              className="rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white"
                            >
                              승인
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="REJECTED"
                              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700"
                            >
                              반려
                            </button>
                          </div>
                        </form>
                      )}

                      {proof.user_id === user.id &&
                        proof.verification_status === "PENDING" && (
                          <form action={deleteProofAction} className="mt-3">
                            <input
                              type="hidden"
                              name="proofId"
                              value={proof.id}
                            />
                            <input
                              type="hidden"
                              name="groupSlug"
                              value={group.slug}
                            />
                            <button
                              type="submit"
                              className="text-sm font-bold text-red-700"
                            >
                              검수 요청 취소
                            </button>
                          </form>
                        )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-5 rounded-2xl bg-[var(--surface-subtle)] px-5 py-10 text-center text-sm text-[var(--muted)]">
                등록된 풀이가 없습니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
