/**
 * 그룹의 최근 활동입니다. `get_group_activity()`가 돌려주는 모양 그대로이고,
 * 문장은 화면이 만듭니다 — 말을 바꾸려고 마이그레이션을 하지 않으려는 것입니다.
 */

export const ACTIVITY_KINDS = [
  /** 도장을 찍었습니다. 기록 종류를 쓰지 않는 그룹입니다. */
  "STAMP",
  /** 시각을 남기는 그룹에서 도장을 찍었습니다. */
  "CLOCK",
  /** 착석 도장 */
  "SEAT_START",
  /** 퇴근 도장 */
  "SEAT_END",
  /** 남의 기록에 응원을 보냈습니다. */
  "CHEER",
  "APPROVED",
  "REJECTED",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type GroupActivityEvent = {
  at: string;
  kind: ActivityKind;
  actorName: string;
  /** 응원과 검수처럼 상대가 있는 일에만 있습니다. */
  targetName: string | null;
  /** 시각이면 자정부터 흐른 분, 시간이면 머문 분입니다. */
  minutes: number | null;
  /** 검수 피드백입니다. */
  note: string | null;
  proofId: string;
};

export function isActivityKind(value: unknown): value is ActivityKind {
  return ACTIVITY_KINDS.includes(value as ActivityKind);
}

/**
 * 오늘 일은 시각으로, 지난 일은 날짜로 적습니다.
 * ‘3분 전’처럼 흐르는 표현은 서버에서 그린 순간 굳어 버려 쓰지 않습니다.
 */
export function activityTime(at: string, today: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  if (date === today) return `${part("hour")}:${part("minute")}`;
  return `${Number(part("month"))}.${Number(part("day"))}`;
}
