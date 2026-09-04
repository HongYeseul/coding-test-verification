export type OverviewDay = {
  date: string;
  approved: number;
  pending: number;
  rejected: number;
};

export type OverviewMember = {
  userId: string;
  displayName: string;
  role: string;
  todaySubmitted: number;
  weekApproved: number;
  totalApproved: number;
  pending: number;
  days: OverviewDay[];
};

export type GroupOverviewData = {
  today: string;
  weekStart: string;
  days: string[];
  members: OverviewMember[];
};
