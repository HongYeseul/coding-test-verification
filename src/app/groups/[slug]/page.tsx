import Link from "next/link";
import { InvitePopover } from "@/components/invite-popover";
import { PhotoProofForm } from "@/components/photo-proof-form";
import { getSiteUrl } from "@/lib/supabase/config";
import { notFound, redirect } from "next/navigation";

import {
  approveMembershipAction,
  rotateInviteCodeAction,
  setMemberRoleAction,
  updateGroupSettingsAction,
} from "@/app/actions/groups";
import { AppShell } from "@/components/app-shell";
import { StatusMessage } from "@/components/status-message";
import { requireUser } from "@/lib/auth";
import { firstQueryValue } from "@/lib/form";
import { GroupOverview } from "@/components/group-overview";
import { GroupProblems } from "@/components/group-problems";
import { ProofFilterForm } from "@/components/proof-filter-form";
import { ProofRecordList } from "@/components/proof-record-list";
import type { ProofRecord } from "@/components/proof-record-list";
import { githubHandle } from "@/lib/profile";
import { problemLink } from "@/lib/proof-input";
import type { GroupOverviewData } from "@/lib/group-overview";
import type {
  GroupProblemTitleRow,
  ProblemProofRow,
} from "@/lib/group-problems";

type MembershipRow = {
  user_id: string;
  role: "OWNER" | "REVIEWER" | "MEMBER";
  status: "PENDING" | "ACTIVE" | "REVOKED";
  joined_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string;
  bio: string | null;
  github_login: string | null;
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

const roleLabels: Record<string, string> = {
  OWNER: "소유자",
  REVIEWER: "검수자",
  MEMBER: "멤버",
};

const proofStatusLabels: Record<string, string> = {
  PENDING: "◷ 검수 대기",
  AUTO_APPROVED: "✓ 자동 인정",
  MANUAL_REVIEWED: "✓ 승인",
  API_VERIFIED: "✓ 자동 확인",
  REJECTED: "× 반려",
  CANCELING: "× 취소 처리 중",
};

const proofStatusTones: Record<string, ProofRecord["statusTone"]> = {
  PENDING: "pending",
  AUTO_APPROVED: "approved",
  MANUAL_REVIEWED: "approved",
  API_VERIFIED: "approved",
  REJECTED: "rejected",
  CANCELING: "rejected",
};

const proofStatusFilters = [
  "all",
  "participating",
  "pending",
  "approved",
  "rejected",
] as const;
const proofPeriodFilters = ["all", "today", "week"] as const;

function selectedFilter<T extends readonly string[]>(
  value: string,
  allowed: T,
  fallback: T[number],
) {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? "" : value;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

function todayInKorea() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function weekStart(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

/** 목록에 짧게 보여줄 한국시간 날짜와 시각입니다. */
function proofDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("month")}.${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

/** 닉네임이 바뀌어도 누구인지 알 수 있도록 GitHub 아이디를 함께 보여줍니다. */
function MemberLabel({
  profile,
  fallback,
}: {
  profile?: ProfileRow;
  fallback: string;
}) {
  const handle = githubHandle(profile?.github_login);
  return (
    <span className="min-w-0 text-[15px] font-medium">
      {profile?.display_name ?? fallback}
      {handle && (
        <span className="ml-1 font-mono text-[13px] font-normal text-sub">
          @{handle}
        </span>
      )}
    </span>
  );
}

export default async function GroupPage({
  params,
  searchParams,
}: PageProps<"/groups/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const requestedMember = firstQueryValue(query.proofMember) ?? "";
  const proofNameQuery = (firstQueryValue(query.proofQuery) ?? "")
    .trim()
    .slice(0, 80);
  const proofStatus = selectedFilter(
    firstQueryValue(query.proofStatus) ?? "",
    proofStatusFilters,
    "all",
  );
  const proofPeriod = selectedFilter(
    firstQueryValue(query.proofPeriod) ?? "",
    proofPeriodFilters,
    "all",
  );
  const proofDate = validDate(firstQueryValue(query.proofDate) ?? "");
  const requestedWeek = validDate(firstQueryValue(query.week) ?? "");
  const { supabase, user } = await requireUser(`/groups/${slug}`);
  const { data: group } = await supabase
    .from("groups")
    .select("id, name, slug, owner_id, auto_approve")
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

  const isOwner = currentMembership.role === "OWNER";
  const [{ data: membershipData }, overviewResult, { data: invitation }] =
    await Promise.all([
      supabase
        .from("group_members")
        .select("user_id, role, status, joined_at")
        .eq("group_id", group.id)
        .neq("status", "REVOKED")
        .order("created_at"),
      supabase.rpc("get_group_overview", {
        target_group_id: group.id,
        target_week_start: requestedWeek || null,
      }),
      isOwner
        ? supabase
            .from("group_invite_codes")
            .select("code, expires_at")
            .eq("group_id", group.id)
            .gt("expires_at", "now")
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const overview = overviewResult.error
    ? null
    : (overviewResult.data as GroupOverviewData | null);

  const memberships = (membershipData ?? []) as MembershipRow[];
  const memberIds = memberships.map((membership) => membership.user_id);
  const { data: profileData } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, bio, github_login")
        .in("id", memberIds)
    : { data: [] };
  const profiles = (profileData ?? []) as ProfileRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const activeMemberIds = memberships
    .filter((membership) => membership.status === "ACTIVE")
    .map((membership) => membership.user_id);
  const memberFilter = activeMemberIds.includes(requestedMember)
    ? requestedMember
    : "";
  const matchingMemberIds = proofNameQuery
    ? activeMemberIds.filter((memberId) =>
        (profileById.get(memberId)?.display_name ?? "")
          .toLocaleLowerCase("ko-KR")
          .includes(proofNameQuery.toLocaleLowerCase("ko-KR")),
      )
    : activeMemberIds;
  const memberMatchesName =
    !memberFilter ||
    !proofNameQuery ||
    matchingMemberIds.includes(memberFilter);

  let proofData: unknown[] = [];
  if (
    (!requestedMember || memberFilter) &&
    (!proofNameQuery || matchingMemberIds.length > 0) &&
    memberMatchesName
  ) {
    let proofRequest = supabase
      .from("proofs")
      .select(
        "id, user_id, platform_account_id, problem_key, problem_url, problem_title, accepted_at, verification_status, evidence_path",
      )
      .eq("group_id", group.id);
    if (memberFilter) proofRequest = proofRequest.eq("user_id", memberFilter);
    else if (proofNameQuery)
      proofRequest = proofRequest.in("user_id", matchingMemberIds);
    if (proofStatus === "participating")
      proofRequest = proofRequest.in("verification_status", [
        "PENDING",
        "AUTO_APPROVED",
        "MANUAL_REVIEWED",
        "API_VERIFIED",
      ]);
    else if (proofStatus === "pending")
      proofRequest = proofRequest.eq("verification_status", "PENDING");
    else if (proofStatus === "approved")
      proofRequest = proofRequest.in("verification_status", [
        "AUTO_APPROVED",
        "MANUAL_REVIEWED",
        "API_VERIFIED",
      ]);
    else if (proofStatus === "rejected")
      proofRequest = proofRequest.eq("verification_status", "REJECTED");

    const today = overview?.today ?? todayInKorea();
    const dateStart =
      proofDate ||
      (proofPeriod === "today"
        ? today
        : proofPeriod === "week"
          ? (overview?.weekStart ?? weekStart(today))
          : "");
    if (dateStart)
      proofRequest = proofRequest.gte(
        "created_at",
        new Date(`${dateStart}T00:00:00+09:00`).toISOString(),
      );
    const dateEnd =
      proofDate ||
      (proofPeriod === "today"
        ? today
        : proofPeriod === "week"
          ? (overview?.weekEnd ?? "")
          : "");
    if (dateEnd)
      proofRequest = proofRequest.lt("created_at", nextDate(dateEnd));

    const response = await proofRequest
      .order("accepted_at", { ascending: false })
      .limit(50);
    proofData = response.data ?? [];
  }

  const proofs = proofData as ProofRow[];
  const proofIds = proofs.map((proof) => proof.id);
  const accountIds = [
    ...new Set(
      proofs.flatMap((proof) =>
        proof.platform_account_id ? [proof.platform_account_id] : [],
      ),
    ),
  ];
  const [
    { data: reviewData },
    { data: accountData },
    { data: problemData },
    { data: groupTitleData },
  ] = await Promise.all([
      proofIds.length
        ? supabase
            .from("proof_reviews")
            .select("proof_id, decision, note")
            .in("proof_id", proofIds)
        : Promise.resolve({ data: [] }),
      accountIds.length
        ? supabase
            .from("platform_accounts")
            .select("id, user_id, platform, handle, verification_status")
            .in("id", accountIds)
        : Promise.resolve({ data: [] }),
      // 문제 목록은 기록 목록의 필터와 무관하게 그룹 전체에서 최근 링크를 모읍니다.
      supabase
        .from("proofs")
        .select("problem_url, problem_title, user_id, created_at")
        .eq("group_id", group.id)
        .not("problem_url", "is", null)
        .in("verification_status", [
          "PENDING",
          "AUTO_APPROVED",
          "MANUAL_REVIEWED",
          "API_VERIFIED",
        ])
        .order("created_at", { ascending: false })
        .limit(200),
      // 소유자·검수자가 정한 제목입니다. 기록에 적힌 제목보다 앞섭니다.
      supabase
        .from("group_problem_titles")
        .select("url, title")
        .eq("group_id", group.id),
    ]);
  const accounts = (accountData ?? []) as PlatformAccountRow[];
  const problemRows = (problemData ?? []) as ProblemProofRow[];
  const groupTitles = (groupTitleData ?? []) as GroupProblemTitleRow[];
  const reviews = (reviewData ?? []) as ReviewRow[];
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const reviewByProofId = new Map(
    reviews.map((review) => [review.proof_id, review]),
  );

  const canReview = ["OWNER", "REVIEWER"].includes(currentMembership.role);
  const pendingMemberships = memberships.filter(
    (membership) => membership.status === "PENDING",
  );
  const manageableMembers = memberships.filter(
    (membership) =>
      membership.status === "ACTIVE" &&
      membership.role !== "OWNER" &&
      membership.user_id !== user.id,
  );
  // 이번 주가 아닐 때만 주소에 주를 남겨 링크와 폼 사이에서 유지합니다.
  const weekQuery =
    overview && overview.weekStart !== overview.currentWeekStart
      ? `week=${overview.weekStart}`
      : "";
  const proofFilterParams = new URLSearchParams();
  if (proofNameQuery) proofFilterParams.set("proofQuery", proofNameQuery);
  if (memberFilter) proofFilterParams.set("proofMember", memberFilter);
  if (proofStatus !== "all") proofFilterParams.set("proofStatus", proofStatus);
  if (proofPeriod !== "all") proofFilterParams.set("proofPeriod", proofPeriod);
  if (proofDate) proofFilterParams.set("proofDate", proofDate);
  const proofFilterQuery = proofFilterParams.toString();
  const hasProofFilters = Boolean(
    memberFilter ||
    proofNameQuery ||
    proofDate ||
    proofStatus !== "all" ||
    proofPeriod !== "all",
  );

  const groupPending =
    overview?.members.reduce((total, member) => total + member.pending, 0) ?? 0;

  // 탭은 기간과 선택한 주만 유지하고 나머지 조건은 탭이 정합니다.
  const groupSlug = group.slug;
  function tabHref(extra: Record<string, string>) {
    const params = new URLSearchParams();
    if (proofPeriod !== "all") params.set("proofPeriod", proofPeriod);
    if (weekQuery && overview) params.set("week", overview.weekStart);
    for (const [key, value] of Object.entries(extra)) params.set(key, value);
    const search = params.toString();
    return `/groups/${groupSlug}${search ? `?${search}` : ""}#proof-records`;
  }

  const mineTab = memberFilter === user.id;
  const pendingTab = !mineTab && proofStatus === "pending";
  const tabs = [
    { label: "전체 기록", count: null, active: !mineTab && !pendingTab, href: tabHref({}) },
    {
      label: "검수 대기",
      count: groupPending,
      active: pendingTab,
      href: tabHref({ proofStatus: "pending" }),
    },
    {
      label: "내 기록",
      count: null,
      active: mineTab,
      href: tabHref({ proofMember: user.id }),
    },
  ];

  const records: ProofRecord[] = proofs.map((proof) => {
    const account = accountById.get(proof.platform_account_id ?? "");
    const review = reviewByProofId.get(proof.id);
    const active = proof.verification_status !== "CANCELING";
    const link = active ? problemLink(proof.problem_url) : null;
    const { date, time } = proofDateTime(proof.accepted_at);
    return {
      id: proof.id,
      title:
        proof.problem_title ||
        (proof.evidence_path ? "사진 풀이 기록" : proof.problem_key),
      memberName: profileById.get(proof.user_id)?.display_name ?? "멤버",
      memberHandle: githubHandle(profileById.get(proof.user_id)?.github_login),
      memberBio: profileById.get(proof.user_id)?.bio ?? null,
      isMine: proof.user_id === user.id,
      date,
      time,
      registeredAt: displayDate(proof.accepted_at),
      statusLabel:
        proofStatusLabels[proof.verification_status] ??
        proof.verification_status,
      statusTone: proofStatusTones[proof.verification_status] ?? "pending",
      source: account
        ? `${platformLabels[account.platform]} ${account.handle}`
        : "사진 인증",
      hasPhoto: Boolean(proof.evidence_path) && active,
      problemUrl: link?.url ?? null,
      problemPlatform: link?.platform ?? null,
      reviewLabel: review
        ? review.decision === "APPROVED"
          ? "승인"
          : "반려"
        : null,
      reviewNote: review?.note ?? null,
      // 자동 인정된 기록도 검수자가 반려할 수 있습니다.
      reviewable:
        canReview &&
        proof.user_id !== user.id &&
        ["PENDING", "AUTO_APPROVED"].includes(proof.verification_status),
      cancelable:
        proof.user_id === user.id &&
        ["PENDING", "AUTO_APPROVED", "CANCELING"].includes(
          proof.verification_status,
        ),
      cancelRetry: proof.verification_status === "CANCELING",
    };
  });

  return (
    <AppShell
      context={group.name}
      actions={
        <div className="flex items-center gap-3">
          <Link href="/settings/profile" className="text-[13px] text-sub">
            프로필
          </Link>
          <Link href="/dashboard" className="text-[13px] text-sub">
            그룹 목록
          </Link>
        </div>
      }
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>{group.name}</h1>
          <p className="mt-1 text-[15px] text-sub">
            멤버 {activeMemberIds.length}명 · 내 역할:{" "}
            {roleLabels[currentMembership.role] ?? "멤버"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <InvitePopover
              inviteUrl={
                invitation ? `${getSiteUrl()}/join/${invitation.code}` : undefined
              }
            >
              <form
                action={rotateInviteCodeAction}
                className="mt-4 border-t border-line pt-4"
              >
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="groupSlug" value={group.slug} />
                {invitation ? (
                  <div className="rounded-lg bg-soft p-4">
                    <p className="font-mono text-2xl font-bold tracking-widest select-all">
                      {invitation.code}
                    </p>
                    <p className="mt-2 text-[13px] text-sub">
                      {displayDate(invitation.expires_at)}까지 사용 가능
                    </p>
                  </div>
                ) : (
                  <p className="rounded-lg bg-soft p-4 text-[13px] text-sub">
                    사용 가능한 초대코드가 없습니다.
                  </p>
                )}
                <button type="submit" className="btn mt-3 w-full">
                  {invitation ? "새 초대코드 만들기" : "5자리 초대코드 만들기"}
                </button>
                <p className="mt-2 text-[13px] text-sub">
                  여러 사람이 7일 동안 사용할 수 있습니다. 새로 만들면 이전
                  코드는 만료됩니다.
                </p>
              </form>
            </InvitePopover>
          )}
          <PhotoProofForm
            groupId={group.id}
            groupSlug={group.slug}
            userId={user.id}
          />
        </div>
      </header>

      <div className="mb-5 empty:mb-0">
        <StatusMessage
          error={firstQueryValue(query.error)}
          message={firstQueryValue(query.message)}
        />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-6">
        <div className="min-w-0">
      {overview ? (
        <GroupOverview
          data={overview}
          currentUserId={user.id}
          groupSlug={group.slug}
          proofFilterQuery={proofFilterQuery}
        />
      ) : (
        <p
          role="alert"
          className="mb-7 rounded-xl border border-line bg-soft p-5 text-[15px] text-warn"
        >
          인증 현황을 불러오지 못했습니다. 잠시 후 페이지를 새로고침해주세요.
        </p>
      )}

      <section id="proof-records" aria-label="풀이 기록" className="scroll-mt-4">
        <div className="mb-3">
          <h2>풀이 기록</h2>
        </div>

        <nav aria-label="기록 분류" className="flex gap-6 border-b border-line">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`border-b-2 pt-3 pb-3 text-[15px] ${
                tab.active
                  ? "border-ink font-[650] text-ink"
                  : "border-transparent text-sub"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1 text-[12px] text-sub tabular-nums">
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <ProofFilterForm action={`/groups/${group.slug}#proof-records`}>
          {proofDate && (
            <input type="hidden" name="proofDate" value={proofDate} />
          )}
          {weekQuery && overview && (
            <input type="hidden" name="week" value={overview.weekStart} />
          )}
          <input
            type="search"
            name="proofQuery"
            aria-label="멤버 이름 검색"
            defaultValue={proofNameQuery}
            maxLength={80}
            placeholder="이름 검색"
            className="w-36"
          />
          <select
            name="proofMember"
            aria-label="멤버"
            defaultValue={memberFilter}
          >
            <option value="">모든 멤버</option>
            {memberships
              .filter((membership) => membership.status === "ACTIVE")
              .map((membership) => (
                <option key={membership.user_id} value={membership.user_id}>
                  {profileById.get(membership.user_id)?.display_name ??
                    "멤버"}
                </option>
              ))}
          </select>
          <select name="proofStatus" aria-label="상태" defaultValue={proofStatus}>
            <option value="all">전체 상태</option>
            <option value="participating">승인·검수 대기</option>
            <option value="pending">검수 대기</option>
            <option value="approved">승인</option>
            <option value="rejected">반려</option>
          </select>
          <select name="proofPeriod" aria-label="기간" defaultValue={proofPeriod}>
            <option value="all">전체 기간</option>
            <option value="today">오늘</option>
            <option value="week">이번 주</option>
          </select>
          <button type="submit" className="btn">
            적용
          </button>
          {hasProofFilters && (
            <Link
              href={`/groups/${group.slug}${weekQuery ? `?${weekQuery}` : ""}#proof-records`}
              className="text-[13px] text-sub underline"
            >
              초기화
            </Link>
          )}
          <span className="ml-auto text-[13px] text-sub tabular-nums">
            {proofDate ? `${proofDate} · ` : "최신순 · "}
            {records.length}건
          </span>
        </ProofFilterForm>

        <ProofRecordList
          records={records}
          groupSlug={group.slug}
          emptyTitle={
            hasProofFilters ? "해당하는 기록이 없어요" : "아직 등록된 풀이가 없어요"
          }
          emptyDescription={
            hasProofFilters
              ? "멤버 또는 기간을 바꿔보세요."
              : "풀이 인증하기로 첫 기록을 남겨보세요."
          }
        />
        <p className="mt-4 text-[12px] text-sub">
          최근 등록순으로 최대 50개까지 보여줍니다. 기록을 누르면 사진과 검수
          내용을 확인할 수 있어요.
        </p>
      </section>
        </div>

        {/* 좁은 화면에서는 기록 아래로 쌓이고, 넓으면 스크롤을 따라옵니다. */}
        <aside className="mt-7 lg:sticky lg:top-6 lg:mt-0 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
          <GroupProblems
            rows={problemRows}
            groupTitles={groupTitles}
            profileById={profileById}
            currentUserId={user.id}
            groupSlug={group.slug}
            canEditTitle={canReview}
          />
        </aside>
      </div>

      {isOwner && (
        <section aria-label="그룹 설정" className="mt-7">
          <h2>그룹 설정</h2>
          <form
            action={updateGroupSettingsAction}
            className="mt-3 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line px-4 py-4"
          >
            <input type="hidden" name="groupId" value={group.id} />
            <input type="hidden" name="groupSlug" value={group.slug} />
            <label className="flex max-w-xl items-start gap-2 text-[15px]">
              <input
                type="checkbox"
                name="autoApprove"
                defaultChecked={group.auto_approve}
                className="mt-1"
              />
              <span>
                자동 인정
                <span className="mt-1 block text-[13px] text-sub">
                  켜면 새 기록이 등록하는 순간 인정됩니다. 소유자와 검수자가
                  반려하면 미인정으로 내려갑니다. 이미 등록된 기록은 그대로
                  둡니다.
                </span>
              </span>
            </label>
            <button type="submit" className="btn">
              저장
            </button>
          </form>
        </section>
      )}

      {isOwner && (pendingMemberships.length > 0 || manageableMembers.length > 0) && (
        <section aria-label="멤버 관리" className="mt-7">
          <h2>멤버 관리</h2>
          {pendingMemberships.length > 0 && (
            <>
              <p className="mt-3 text-[13px] text-sub">
                가입 승인 대기 {pendingMemberships.length}명
              </p>
              <ul className="mt-2 rounded-xl border border-line">
                {pendingMemberships.map((membership) => (
                  <li
                    key={membership.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <MemberLabel
                      profile={profileById.get(membership.user_id)}
                      fallback={`멤버 ${membership.user_id.slice(0, 8)}`}
                    />
                    <form action={approveMembershipAction}>
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="groupSlug" value={group.slug} />
                      <input
                        type="hidden"
                        name="userId"
                        value={membership.user_id}
                      />
                      <button type="submit" className="btn btn-primary">
                        가입 승인
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}

          {manageableMembers.length > 0 && (
            <>
              <p className="mt-4 text-[13px] text-sub">검수자 지정</p>
              <ul className="mt-2 rounded-xl border border-line">
                {manageableMembers.map((membership) => (
                  <li
                    key={membership.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <MemberLabel
                      profile={profileById.get(membership.user_id)}
                      fallback="멤버"
                    />
                    <form
                      action={setMemberRoleAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="groupId" value={group.id} />
                      <input type="hidden" name="groupSlug" value={group.slug} />
                      <input
                        type="hidden"
                        name="userId"
                        value={membership.user_id}
                      />
                      <select
                        name="role"
                        aria-label={`${profileById.get(membership.user_id)?.display_name ?? "멤버"} 역할`}
                        defaultValue={membership.role}
                      >
                        <option value="MEMBER">멤버</option>
                        <option value="REVIEWER">검수자</option>
                      </select>
                      <button type="submit" className="btn">
                        변경
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </AppShell>
  );
}
