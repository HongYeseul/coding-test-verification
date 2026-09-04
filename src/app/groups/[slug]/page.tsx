import Link from "next/link";
import Image from "next/image";
import { PhotoProofForm } from "@/components/photo-proof-form";
import { getSiteUrl } from "@/lib/supabase/config";
import { notFound, redirect } from "next/navigation";

import {
  approveMembershipAction,
  rotateInviteCodeAction,
  setMemberRoleAction,
} from "@/app/actions/groups";
import { deleteProofAction, reviewProofAction } from "@/app/actions/proofs";
import { StatusMessage } from "@/components/status-message";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";
import { GroupOverview } from "@/components/group-overview";
import type { GroupOverviewData } from "@/lib/group-overview";

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
  platform_account_id: string | null;
  problem_key: string;
  problem_url: string | null;
  evidence_path: string | null;
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

  const [
    { data: membershipData },
    { data: accountData },
    { data: proofData },
    overviewResult,
  ] = await Promise.all([
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
        "id, user_id, platform_account_id, problem_key, problem_url, problem_title, accepted_at, verification_status, evidence_path",
      )
      .eq("group_id", group.id)
      .order("accepted_at", { ascending: false })
      .limit(50),
    supabase.rpc("get_group_overview", { target_group_id: group.id }),
  ]);

  const overview = overviewResult.error
    ? null
    : (overviewResult.data as GroupOverviewData | null);

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

  const canReview = ["OWNER", "REVIEWER"].includes(currentMembership.role);
  const isOwner = currentMembership.role === "OWNER";
  const { data: invitation } = isOwner
    ? await supabase
        .from("group_invite_codes")
        .select("code, expires_at")
        .eq("group_id", group.id)
        .gt("expires_at", "now")
        .maybeSingle()
    : { data: null };
  const validInvitation = Boolean(invitation);

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

        {overview ? (
          <GroupOverview data={overview} currentUserId={user.id} />
        ) : (
          <p
            role="alert"
            className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            인증 현황을 불러오지 못했습니다. 잠시 후 페이지를 새로고침해주세요.
          </p>
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
              action={rotateInviteCodeAction}
              className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
            >
              <h2 className="text-xl font-extrabold">멤버 초대</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                상대방의 계정 정보 없이 코드를 공유하세요. 가입 신청 후 소유자의
                승인이 필요합니다.
              </p>
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="groupSlug" value={group.slug} />
              {invitation ? (
                <div className="mt-5 space-y-3 rounded-xl bg-[var(--surface-subtle)] p-4">
                  <p className="font-mono text-4xl font-black tracking-widest">
                    {invitation.code}
                  </p>
                  <p className="break-all text-sm">
                    {getSiteUrl()}/join/{invitation.code}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {displayDate(invitation.expires_at)}까지 사용 가능
                  </p>
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--muted)]">
                  사용 가능한 초대코드가 없습니다.
                </p>
              )}
              <button
                type="submit"
                className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-[var(--accent-ink)]"
              >
                {validInvitation
                  ? "새 초대코드 만들기"
                  : "5자리 초대코드 만들기"}
              </button>
              <p className="mt-2 text-xs text-[var(--muted)]">
                여러 사람이 7일 동안 사용할 수 있습니다. 새로 만들면 이전 코드는
                만료됩니다.
              </p>
            </form>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <PhotoProofForm
              groupId={group.id}
              groupSlug={group.slug}
              userId={user.id}
            />
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
                  const account = accountById.get(
                    proof.platform_account_id ?? "",
                  );
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
                            href={
                              proof.problem_url ??
                              `/proofs/${proof.id}/evidence`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold hover:text-[var(--accent-strong)]"
                          >
                            {proof.problem_title ||
                              (proof.evidence_path
                                ? "사진 풀이 기록"
                                : proof.problem_key)}
                          </a>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {profileById.get(proof.user_id) ?? "멤버"} ·{" "}
                            {account
                              ? `${platformLabels[account.platform]} ${account.handle}`
                              : "사진 인증"}
                          </p>
                          <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                            {proof.platform_account_id ? "풀이 " : "등록 "}
                            {displayDate(proof.accepted_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-xs font-bold">
                          {proofStatusLabels[proof.verification_status] ??
                            proof.verification_status}
                        </span>
                      </div>

                      {proof.evidence_path && (
                        <a
                          href={`/proofs/${proof.id}/evidence`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 block"
                        >
                          <Image
                            src={`/proofs/${proof.id}/evidence`}
                            alt="풀이 인증 사진"
                            width={720}
                            height={480}
                            unoptimized
                            className="max-h-80 w-full rounded-xl bg-[var(--surface-subtle)] object-contain"
                          />
                          <span className="mt-1 block text-xs text-[var(--muted)]">
                            사진 크게 보기
                          </span>
                        </a>
                      )}

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
