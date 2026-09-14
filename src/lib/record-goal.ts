/**
 * 기상·착석 스터디의 기록값과 목표를 다루는 규칙 한 벌입니다.
 *
 * 값은 언제나 분(minute) 하나입니다. 시각이면 그날 자정(한국시간)부터 흐른 분이고,
 * 시간이면 머문 분입니다. 단위를 하나로 두면 목표와의 차이가 뺄셈 한 번으로 나오고,
 * 화면에 그릴 때 형식만 갈립니다. DB의 groups.record_kind와 같은 값을 씁니다.
 */

export const RECORD_KINDS = ["NONE", "CLOCK", "DURATION"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export function isRecordKind(value: unknown): value is RecordKind {
  return RECORD_KINDS.includes(value as RecordKind);
}

/** 분의 최댓값입니다. DB의 CHECK와 같이 바꿉니다. */
export const MAX_RECORD_MINUTES = 1440;

/** 화면에서 기록을 부르는 말입니다. 행동은 언제나 ‘도장 찍기’ 하나입니다. */
export const recordKindLabels: Record<RecordKind, string> = {
  NONE: "기록하지 않음",
  CLOCK: "시각",
  DURATION: "시간",
};

/** 목표 입력 옆에 붙는 설명입니다. */
export const goalLabels: Record<RecordKind, string> = {
  NONE: "목표",
  CLOCK: "목표 시각",
  DURATION: "목표 시간",
};

/** 390 → "06:30" */
export function formatClock(minutes: number) {
  const clamped = Math.max(0, Math.min(MAX_RECORD_MINUTES, Math.round(minutes)));
  const hour = Math.floor(clamped / 60) % 24;
  const minute = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "06:30" → 390. 형식이 아니면 null입니다. */
export function parseClock(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** 260 → "4시간 20분". 읽는 문장에 씁니다. */
export function formatDuration(minutes: number) {
  const clamped = Math.max(0, Math.min(MAX_RECORD_MINUTES, Math.round(minutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  if (!hour) return `${minute}분`;
  if (!minute) return `${hour}시간`;
  return `${hour}시간 ${minute}분`;
}

/** 260 → "4시간20분". 도장판 칸처럼 좁은 자리에 씁니다. */
export function formatDurationCompact(minutes: number) {
  return formatDuration(minutes).replace(" ", "");
}

/** 종류에 맞는 표시입니다. 칸에서는 compact를 씁니다. */
export function formatRecord(
  kind: RecordKind,
  minutes: number,
  compact = false,
) {
  if (kind === "CLOCK") return formatClock(minutes);
  if (kind === "DURATION")
    return compact ? formatDurationCompact(minutes) : formatDuration(minutes);
  return "";
}

/**
 * 목표와 견준 결과입니다. `short`는 칸 옆에 붙는 짧은 표시입니다.
 *
 * 시각은 목표보다 늦으면 모자란 것이고, 시간은 목표보다 짧으면 모자란 것입니다.
 * 방향이 반대라 한곳에서 뒤집어 두고 화면은 `missed`만 봅니다.
 */
export function compareGoal(
  kind: RecordKind,
  minutes: number,
  goalMinutes: number | null,
) {
  if (kind === "NONE" || goalMinutes === null) return null;
  const difference = minutes - goalMinutes;
  if (kind === "CLOCK") {
    return {
      missed: difference > 0,
      short: difference === 0 ? "정시" : `${difference > 0 ? "+" : ""}${difference}`,
      description:
        difference === 0
          ? "목표 시각 정각"
          : difference > 0
            ? `목표보다 ${difference}분 늦음`
            : `목표보다 ${-difference}분 이름`,
    };
  }
  return {
    missed: difference < 0,
    short: difference === 0 ? "달성" : `${difference > 0 ? "+" : ""}${difference}`,
    description:
      difference === 0
        ? "목표 시간 달성"
        : difference > 0
          ? `목표보다 ${formatDuration(difference)} 더`
          : `목표까지 ${formatDuration(-difference)} 남음`,
  };
}

/**
 * 착석과 퇴근을 한 줄로 적습니다. 예: "13:00 → 17:20"
 *
 * 자정을 넘겨 앉아 있었으면 끝 시각이 하루를 넘습니다. formatClock은 1440분에서
 * 잘라내므로 여기서 먼저 하루로 되돌립니다 — 23:00에 두 시간이면 01:00입니다.
 */
export function formatSeatRange(startMinutes: number, durationMinutes: number) {
  const endMinutes = (startMinutes + durationMinutes) % MAX_RECORD_MINUTES;
  return `${formatClock(startMinutes)} → ${formatClock(endMinutes)}`;
}

/** 아직 퇴근하지 않은 자리입니다. 예: "13:00~" */
export function formatOpenSeat(startMinutes: number) {
  return `${formatClock(startMinutes)}~`;
}

/** 지금 이 순간의 한국시간을 자정부터 흐른 분으로 돌려줍니다. */
export function nowClockMinutes(at: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? "0");
  // 자정을 24로 주는 구현이 있어 24시는 0시로 되돌립니다.
  return (part("hour") % 24) * 60 + part("minute");
}
