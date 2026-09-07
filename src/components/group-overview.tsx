import Link from "next/link";
import type { ReactNode } from "react";

import {
  shiftWeek,
  type GroupOverviewData,
  type OverviewMember,
} from "@/lib/group-overview";
import { githubHandle } from "@/lib/profile";
import { RefreshOverviewButton } from "@/components/refresh-overview-button";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function dayOfMonth(value: string) {
  return Number(value.split("-")[2]);
}

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

/** 카드 상단에서 한눈에 읽어야 하는 숫자 한 칸입니다. */
function Stat({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <span className="grid min-w-max gap-0.5">
      <strong
        className={`text-[28px] leading-[1.1] font-bold tracking-[-1px] tabular-nums ${tone ?? ""}`}
      >
        {children}
      </strong>
      <span className="text-[11px] text-sub">{label}</span>
    </span>
  );
}

/**
 * 멤버를 보여줄 순서로 놓습니다. 이번 주 승인이 많은 순서이고,
 * 같으면 누적 승인이 많은 순서, 그다음 닉네임순입니다.
 * 닉네임까지 같을 때 순서가 흔들리지 않도록 userId로 마지막을 고정합니다.
 */
function sortedMembers(members: OverviewMember[]) {
  return members.toSorted(
    (left, right) =>
      right.weekApproved - left.weekApproved ||
      right.totalApproved - left.totalApproved ||
      left.displayName.localeCompare(right.displayName, "ko") ||
      left.userId.localeCompare(right.userId),
  );
}

/** 이름 옆에 GitHub 아이디를 붙이고, 마우스를 올리면 한 줄 소개를 보여줍니다. */
function MemberCell({ member, isMe }: { member: OverviewMember; isMe: boolean }) {
  const handle = githubHandle(member.githubLogin);
  return (
    <td className="relative h-[52px] border-t border-line text-left text-[13px]">
      <span className="group/member flex items-center gap-1 font-medium sm:gap-[9px]">
        <span
          aria-hidden="true"
          className="hidden size-7 shrink-0 place-items-center rounded-full bg-soft text-[11px] text-sub sm:grid"
        >
          {initials(member.displayName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[11px] sm:text-[13px]">
            {member.displayName}
            {isMe && <span className="ml-[3px] text-[10px] text-sub">나</span>}
            {handle && (
              <span className="ml-[5px] font-mono text-[10px] font-normal text-sub sm:text-[11px]">
                @{handle}
              </span>
            )}
          </span>
          <span className="block text-[11px] text-sub tabular-nums">
            누적 {member.totalApproved} · 대기 {member.pending}
          </span>
        </span>
        {member.bio && (
          <span
            role="tooltip"
            className="pointer-events-none absolute top-full left-2 z-20 hidden w-max max-w-[240px] rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] leading-[1.6] font-normal text-sub group-hover/member:block sm:left-10"
          >
            {member.bio}
          </span>
        )}
      </span>
    </td>
  );
}

export function GroupOverview({
  data,
  currentUserId,
  groupSlug,
  proofFilterQuery,
}: {
  data: GroupOverviewData;
  currentUserId: string;
  groupSlug: string;
  proofFilterQuery: string;
}) {
  const isCurrentWeek = data.weekStart === data.currentWeekStart;
  // 선택한 주를 유지한 채 풀이 기록 필터로 이동하기 위한 조각입니다.
  const weekParam = isCurrentWeek ? "" : `&week=${data.weekStart}`;
  const members = sortedMembers(data.members);
  const weekLabel = isCurrentWeek ? "이번 주" : "선택한 주";
  const todayParticipants = data.members.filter(
    (member) => member.todaySubmitted > 0,
  ).length;
  const weekApproved = data.members.reduce(
    (total, member) => total + member.weekApproved,
    0,
  );
  const groupPending = data.members.reduce(
    (total, member) => total + member.pending,
    0,
  );

  function weekHref(week: string) {
    const params = new URLSearchParams(proofFilterQuery);
    if (week !== data.currentWeekStart) params.set("week", week);
    const query = params.toString();
    return `/groups/${groupSlug}${query ? `?${query}` : ""}`;
  }

  return (
    <section
      aria-labelledby="group-overview-title"
      className="mb-7 rounded-xl border border-line"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-t-[11px] bg-soft px-3 py-4 sm:px-5">
        <h2 id="group-overview-title" className="sr-only">
          {weekLabel} 인증 현황
        </h2>
        <div className="flex items-center gap-6 sm:gap-8">
          <Stat label="오늘 인증" tone="text-brand">
            {todayParticipants}
            <span className="text-[15px] font-[550]">/{data.members.length}</span>
          </Stat>
          <Stat label={`${weekLabel} 승인`}>{weekApproved}</Stat>
          <Stat label="검수 대기" tone={groupPending ? "text-warn" : undefined}>
            {groupPending}
          </Stat>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-[650]">{weekLabel}</span>
          <span className="text-xs text-sub tabular-nums">
            {shortDate(data.weekStart)} — {shortDate(data.weekEnd)}
          </span>
          <WeekArrow
            href={
              data.weekStart > data.firstWeekStart
                ? weekHref(shiftWeek(data.weekStart, -1))
                : null
            }
            label="이전 주 보기"
            symbol="‹"
          />
          <WeekArrow
            href={isCurrentWeek ? null : weekHref(shiftWeek(data.weekStart, 1))}
            label="다음 주 보기"
            symbol="›"
          />
          {!isCurrentWeek && (
            <Link
              href={weekHref(data.currentWeekStart)}
              className="text-xs text-sub underline"
            >
              이번 주로
            </Link>
          )}
          <RefreshOverviewButton />
        </div>
      </div>

      {data.members.length === 0 ? (
        <p className="px-5 py-10 text-center text-xs text-sub">
          아직 활동 중인 멤버가 없습니다.
        </p>
      ) : (
        <div className="px-2 pt-2 sm:px-5">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">
              멤버별 주간 인증 현황. 승인 열은 선택한 주의 승인 건수입니다. 멤버는
              {weekLabel} 승인이 많은 순서로 놓고, 같으면 누적 승인이 많은 순서,
              그다음 닉네임순입니다.
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="relative w-[36%] py-[7px] text-left text-[11px] font-medium text-sub sm:w-[34%]"
                >
                  <span className="group/sort inline-flex items-center gap-1">
                    멤버
                    <span className="font-normal">· {weekLabel} 승인순</span>
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute top-full left-0 z-20 hidden w-max max-w-[260px] rounded-lg border border-line bg-canvas px-3 py-2 text-[11px] leading-[1.6] font-normal text-sub group-hover/sort:block"
                    >
                      {weekLabel} 승인이 많은 순서입니다. 같으면 누적 승인이 많은
                      순서, 그다음 닉네임순입니다.
                    </span>
                  </span>
                </th>
                {data.days.map((date, index) => {
                  const isToday = date === data.today;
                  return (
                    <th
                      scope="col"
                      key={date}
                      className={`py-[7px] text-center text-[11px] font-medium text-sub ${
                        isToday ? "rounded-t-lg bg-brand-soft/50" : ""
                      }`}
                    >
                      <span className={isToday ? "font-[650] text-brand" : ""}>
                        {weekdays[index]}
                        <br />
                        {dayOfMonth(date)}
                      </span>
                    </th>
                  );
                })}
                <th
                  scope="col"
                  className="w-[9%] py-[7px] text-center text-[11px] font-medium text-sub sm:w-[10%]"
                >
                  승인
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId}>
                  <MemberCell member={member} isMe={member.userId === currentUserId} />
                  {data.days.map((date) => {
                    const day = member.days.find((entry) => entry.date === date);
                    const approved = day?.approved ?? 0;
                    const waiting = day?.pending ?? 0;
                    const rejected = day?.rejected ?? 0;
                    const total = approved + waiting + rejected;
                    const isFuture = date > data.today;
                    const isToday = date === data.today;
                    const marker =
                      waiting > 0 ? "◷" : approved > 0 ? "✓" : "×";
                    // 승인만 채우고 대기·반려는 테두리로 둡니다. 채워진 칸이 곧 성과입니다.
                    const cellTone =
                      waiting > 0
                        ? "border border-line bg-canvas text-warn"
                        : approved > 0
                          ? "bg-primary text-primary-ink"
                          : "border border-line bg-canvas text-danger";
                    const description = `${member.displayName} ${shortDate(date)} 승인 ${approved}건, 검수 대기 ${waiting}건, 반려 ${rejected}건`;

                    return (
                      <td
                        key={date}
                        className={`h-[52px] border-t border-line text-center text-[13px] ${
                          isToday ? "bg-brand-soft/50" : ""
                        }`}
                      >
                        {total > 0 ? (
                          <Link
                            href={`/groups/${groupSlug}?proofMember=${member.userId}&proofDate=${date}${weekParam}#proof-records`}
                            title={description}
                            aria-label={`${description}. 풀이 기록 보기`}
                            className={`inline-grid h-[29px] w-6 place-items-center rounded-lg font-[650] sm:size-[30px] ${cellTone}`}
                          >
                            <span aria-hidden="true">
                              {marker}
                              {total > 1 ? total : ""}
                            </span>
                          </Link>
                        ) : (
                          <span
                            title={isFuture ? "예정" : "미등록"}
                            className={`inline-grid h-[29px] w-6 place-items-center text-sub sm:size-[30px] ${
                              isFuture ? "opacity-25" : "opacity-45"
                            }`}
                          >
                            {isFuture ? "–" : "·"}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td
                    className={`h-[52px] border-t border-line text-center text-[13px] tabular-nums ${
                      member.weekApproved ? "font-[650]" : "text-sub opacity-60"
                    }`}
                  >
                    {member.weekApproved}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-4 px-3 pt-[10px] pb-[13px] text-[11px] text-sub sm:px-5">
        <span className="flex flex-wrap gap-3">
          <span>✓ 승인</span>
          <span>◷ 검수 대기</span>
          <span>× 반려</span>
          <span>· 미등록</span>
        </span>
        <span>한국시간 · 등록일 기준</span>
      </div>
    </section>
  );
}

/** 이동할 주가 없으면 링크 대신 비활성 표시를 렌더링합니다. */
function WeekArrow({
  href,
  label,
  symbol,
}: {
  href: string | null;
  label: string;
  symbol: string;
}) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${label} (이동할 주 없음)`}
        className="p-1.5 text-sub opacity-45"
      >
        {symbol}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className="p-1.5 text-sub">
      {symbol}
    </Link>
  );
}
