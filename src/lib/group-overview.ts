import type { RecordKind } from "@/lib/record-goal";

export type OverviewDay = {
  date: string;
  approved: number;
  pending: number;
  rejected: number;
  /** 기록 종류를 쓰는 그룹에서만 값이 있습니다. 시각은 그날 가장 이른 값, 시간은 합계입니다. */
  recordMinutes: number | null;
  /** 착석 스터디에서 앉은 시각입니다. 값이 있는데 recordMinutes가 없으면 아직 퇴근 전입니다. */
  startMinutes: number | null;
};

export type OverviewMember = {
  userId: string;
  displayName: string;
  githubLogin: string | null;
  bio: string | null;
  role: string;
  todaySubmitted: number;
  weekApproved: number;
  totalApproved: number;
  pending: number;
  /** 멤버가 정한 목표입니다. 정하지 않았으면 null입니다. */
  goalMinutes: number | null;
  featuredProofId: string | null;
  featuredDate: string | null;
  days: OverviewDay[];
};

export type GroupOverviewData = {
  today: string;
  weekStart: string;
  weekEnd: string;
  currentWeekStart: string;
  firstWeekStart: string;
  recordKind: RecordKind;
  days: string[];
  members: OverviewMember[];
};

/** 주간 이동 링크에 쓸 날짜를 앞뒤로 7일 옮깁니다. */
export function shiftWeek(weekStart: string, direction: -1 | 1) {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + direction * 7);
  return date.toISOString().slice(0, 10);
}
