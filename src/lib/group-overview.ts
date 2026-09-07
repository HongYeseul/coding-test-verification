export type OverviewDay = {
  date: string;
  approved: number;
  pending: number;
  rejected: number;
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
  days: string[];
  members: OverviewMember[];
};

/** 주간 이동 링크에 쓸 날짜를 앞뒤로 7일 옮깁니다. */
export function shiftWeek(weekStart: string, direction: -1 | 1) {
  const date = new Date(`${weekStart}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + direction * 7);
  return date.toISOString().slice(0, 10);
}
