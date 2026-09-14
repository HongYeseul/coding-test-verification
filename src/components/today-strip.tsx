import type { GroupOverviewData } from "@/lib/group-overview";
import { Seal } from "@/components/seal";
import { formatRecord } from "@/lib/record-goal";

/** 오늘 날짜를 ‘9월 10일 목요일’로 적습니다. 스터디 하루 기준 날짜를 그대로 받습니다. */
function longDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${value}T12:00:00+09:00`));
}

/**
 * 오늘 띠. 서로 독려하는 서비스인데 ‘오늘 누가 찍었는지’가 표 안에 묻혀 있어
 * 헤더 바로 아래에 오늘만 따로 띄웁니다. 남은 사람을 지목하지 않고,
 * 남은 사람이 나일 때만 이름을 부릅니다.
 */
export function TodayStrip({
  data,
  currentUserId,
}: {
  data: GroupOverviewData;
  currentUserId: string;
}) {
  if (data.members.length === 0) return null;

  const members = data.members.map((member) => {
    const today = member.days.find((day) => day.date === data.today);
    const approved = today?.approved ?? 0;
    const pending = today?.pending ?? 0;
    const rejected = today?.rejected ?? 0;
    const state: "approved" | "pending" | "rejected" | "none" =
      approved > 0
        ? "approved"
        : pending > 0
          ? "pending"
          : rejected > 0
            ? "rejected"
            : "none";
    return { ...member, state, recordMinutes: today?.recordMinutes ?? null };
  });
  const recordKind = data.recordKind;
  // 찍은 사람이 앞에 옵니다. 같은 무리 안에서는 도장판과 같은 순서입니다.
  const order = { approved: 0, pending: 1, rejected: 2, none: 3 } as const;
  members.sort((left, right) => order[left.state] - order[right.state]);

  const stamped = members.filter((member) => member.state !== "none");
  const remaining = members.filter((member) => member.state === "none");
  const me = members.find((member) => member.userId === currentUserId);
  const meRemaining = me?.state === "none";

  let note: string;
  if (remaining.length === 0) note = "모두 찍었어요.";
  else if (meRemaining && remaining.length === 1)
    note = `${me.displayName}님만 남았어요.`;
  else if (meRemaining)
    note = `${me.displayName}님 포함 ${remaining.length}명 남았어요.`;
  else note = `${remaining.length}명 남았어요.`;

  return (
    <section
      aria-label="오늘 도장"
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-surface border border-line bg-surface px-4 py-3 sm:px-5"
    >
      <div className="min-w-[150px]">
        <p className="text-[12px] tracking-[0.04em] text-sub">
          오늘 · {longDate(data.today)}
        </p>
        <p className="mt-0.5 font-serif text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] tabular-nums">
          {stamped.length}
          <span className="ml-1 font-sans text-[15px] font-medium text-sub">
            / {members.length}명 도장
          </span>
        </p>
      </div>
      <ul className="flex min-w-0 flex-1 flex-wrap gap-2">
        {members.map((member) => (
          <li
            key={member.userId}
            className={`inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface pr-3 pl-2 text-[13px] font-medium ${
              member.state === "none" ? "opacity-55" : ""
            }`}
          >
            {member.state === "approved" || member.state === "pending" ? (
              <Seal
                ghost={member.state === "pending"}
                className="size-5"
                tilt={member.state === "pending" ? "-3deg" : "-6deg"}
              />
            ) : member.state === "rejected" ? (
              <span
                aria-hidden="true"
                className="grid size-5 place-items-center rounded-[6px] border border-line text-[11px] font-[650] text-danger"
              >
                ×
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="size-5 rounded-full border border-dashed border-line"
              />
            )}
            {member.displayName}
            {member.userId === currentUserId && (
              <span className="text-[11px] font-normal text-sub">나</span>
            )}
            {/* 기록을 쓰는 그룹에서는 오늘 남긴 값을, 아직이면 목표를 이름 뒤에 답니다. */}
            {recordKind !== "NONE" && member.recordMinutes !== null && (
              <span className="font-mono text-[12px] font-normal text-sub tabular-nums">
                {formatRecord(recordKind, member.recordMinutes, true)}
              </span>
            )}
            {recordKind !== "NONE" &&
              member.recordMinutes === null &&
              member.goalMinutes !== null && (
                <span className="text-[11px] font-normal text-sub">
                  목표{" "}
                  <span className="font-mono tabular-nums">
                    {formatRecord(recordKind, member.goalMinutes)}
                  </span>
                </span>
              )}
          </li>
        ))}
      </ul>
      <p
        className={`text-[13px] whitespace-nowrap ${
          meRemaining ? "font-medium text-brand" : "text-sub"
        }`}
      >
        {note}
      </p>
    </section>
  );
}
