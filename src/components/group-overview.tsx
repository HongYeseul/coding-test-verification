import type { GroupOverviewData } from "@/lib/group-overview";
import { RefreshOverviewButton } from "@/components/refresh-overview-button";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];
const roleLabels: Record<string, string> = {
  OWNER: "소유자",
  REVIEWER: "검수자",
  MEMBER: "멤버",
};

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${Number(day)}`;
}

export function GroupOverview({
  data,
  currentUserId,
}: {
  data: GroupOverviewData;
  currentUserId: string;
}) {
  const todayParticipants = data.members.filter(
    (member) => member.todaySubmitted > 0,
  ).length;
  const weekApproved = data.members.reduce(
    (total, member) => total + member.weekApproved,
    0,
  );
  const pending = data.members.reduce(
    (total, member) => total + member.pending,
    0,
  );

  return (
    <section
      aria-labelledby="group-overview-title"
      className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-[var(--accent-strong)]">
            함께 쌓는 코딩 습관
          </p>
          <h2 id="group-overview-title" className="mt-1 text-xl font-extrabold">
            우리 그룹 인증 현황
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            이번 주 {shortDate(data.weekStart)}(월) ~{" "}
            {shortDate(data.days.at(-1) ?? data.weekStart)}(일)
          </p>
        </div>
        <RefreshOverviewButton />
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-[var(--accent-soft)] px-4 py-4 text-[var(--accent-ink)]">
          <dt className="text-sm font-bold">오늘 인증한 멤버</dt>
          <dd className="mt-2">
            <p className="text-3xl font-black tabular-nums">
              {todayParticipants}
              <span className="ml-1 text-base font-semibold">
                / {data.members.length}명
              </span>
            </p>
            <p className="mt-1 text-xs">승인·검수 대기 포함</p>
          </dd>
        </div>
        <div className="rounded-2xl bg-[var(--surface-subtle)] px-4 py-4">
          <dt className="text-sm font-bold text-[var(--muted-strong)]">
            이번 주 승인
          </dt>
          <dd className="mt-2">
            <p className="text-3xl font-black tabular-nums">
              {weekApproved}
              <span className="ml-1 text-base font-semibold">건</span>
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              이번 주 등록한 인증 중 승인된 기록
            </p>
          </dd>
        </div>
        <div className="rounded-2xl bg-amber-50 px-4 py-4 text-amber-900">
          <dt className="text-sm font-bold">검수를 기다리는 인증</dt>
          <dd className="mt-2">
            <p className="text-3xl font-black tabular-nums">
              {pending}
              <span className="ml-1 text-base font-semibold">건</span>
            </p>
            <p className="mt-1 text-xs">전체 기간의 검수 대기 기록</p>
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-extrabold">멤버별 이번 주 발자취</h3>
        <p className="flex flex-wrap gap-3 text-xs font-semibold">
          <span className="text-[var(--accent-strong)]">✓ 승인</span>
          <span className="text-amber-800">… 대기</span>
          <span className="text-rose-700">× 반려</span>
        </p>
      </div>

      {data.members.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[var(--surface-subtle)] p-5 text-sm text-[var(--muted)]">
          아직 활동 중인 멤버가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 grid gap-4 lg:grid-cols-2">
          {data.members.map((member) => (
            <li
              key={member.userId}
              className="min-w-0 rounded-2xl border border-[var(--line)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="break-all font-extrabold">
                      {member.displayName}
                    </h4>
                    {member.userId === currentUserId && (
                      <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-xs font-bold text-white">
                        나
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {roleLabels[member.role] ?? "멤버"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    member.todaySubmitted > 0
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : "bg-[var(--surface-subtle)] text-[var(--muted-strong)]"
                  }`}
                >
                  {member.todaySubmitted > 0
                    ? `오늘 인증 ${member.todaySubmitted}건`
                    : "오늘 아직 인증 전"}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-subtle)] px-3 py-3 text-center">
                <div>
                  <dt className="text-xs text-[var(--muted)]">주간 승인</dt>
                  <dd className="mt-1 font-extrabold tabular-nums">
                    {member.weekApproved}건
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">누적 승인</dt>
                  <dd className="mt-1 font-extrabold tabular-nums">
                    {member.totalApproved}건
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--muted)]">검수 대기</dt>
                  <dd className="mt-1 font-extrabold tabular-nums text-amber-800">
                    {member.pending}건
                  </dd>
                </div>
              </dl>

              <ul
                aria-label={`${member.displayName}의 주간 인증 기록`}
                className="mt-4 grid grid-cols-7 gap-1.5"
              >
                {data.days.map((date, index) => {
                  const day = member.days.find((entry) => entry.date === date);
                  const approved = day?.approved ?? 0;
                  const waiting = day?.pending ?? 0;
                  const rejected = day?.rejected ?? 0;
                  const isFuture = date > data.today;
                  const isToday = date === data.today;
                  const hasRecords = approved + waiting + rejected > 0;
                  const description = `${date} ${weekdays[index]}요일${isToday ? ", 오늘" : ""}: ${
                    isFuture
                      ? "예정"
                      : `승인 ${approved}건, 검수 대기 ${waiting}건, 반려 ${rejected}건`
                  }`;
                  const cellStyle = isFuture
                    ? "bg-slate-100 text-slate-400"
                    : approved > 0
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : waiting > 0
                        ? "bg-amber-50 text-amber-900"
                        : rejected > 0
                          ? "bg-rose-50 text-rose-700"
                          : "bg-[var(--surface-subtle)] text-[var(--muted)]";

                  return (
                    <li key={date} title={description}>
                      <span className="sr-only">{description}</span>
                      <div aria-hidden="true" className="text-center">
                        <p
                          className={`text-xs ${isToday ? "font-black text-[var(--accent-strong)]" : "text-[var(--muted)]"}`}
                        >
                          {weekdays[index]}
                        </p>
                        <p className="mt-0.5 text-[10px] text-[var(--muted)]">
                          {shortDate(date)}
                        </p>
                        <div
                          className={`mt-1 flex min-h-14 flex-col items-center justify-center rounded-lg px-0.5 py-1 text-xs font-bold tabular-nums ${cellStyle} ${isToday ? "ring-2 ring-[var(--accent-strong)] ring-offset-1" : ""}`}
                        >
                          {isFuture ? (
                            "—"
                          ) : hasRecords ? (
                            <>
                              {approved > 0 && <span>✓{approved}</span>}
                              {waiting > 0 && (
                                <span className="text-amber-800">
                                  …{waiting}
                                </span>
                              )}
                              {rejected > 0 && (
                                <span className="text-rose-700">
                                  ×{rejected}
                                </span>
                              )}
                            </>
                          ) : (
                            "·"
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
        한국시간 인증 등록일 기준 · 현재 활동 중인 멤버의 기록만 집계합니다.
        승인 수에는 검수 대기·반려를 포함하지 않습니다. 사진을 올린 날짜에
        표시되며, 검수 결과에 따라 현황이 바뀝니다.
      </p>
    </section>
  );
}
