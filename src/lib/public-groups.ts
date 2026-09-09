/** 로그인 없이 볼 수 있는 값만 담습니다. 함수가 고른 필드 외에는 나가지 않습니다. */
export type GroupDirectoryEntry = {
  name: string;
  slug: string;
  isPublic: boolean;
  memberCount: number;
  /** 비공개 그룹은 이름과 인원수까지만 공개하므로 활동은 null입니다. */
  weekApproved: number | null;
  days: { date: string; approved: number }[] | null;
};

export type GroupDirectory = {
  today: string;
  weekStart: string;
  totalMembers: number;
  weekApproved: number;
  groups: GroupDirectoryEntry[];
};

export type PublicGroupBoard = {
  name: string;
  slug: string;
  weekStart: string;
  memberCount: number;
  members: {
    displayName: string;
    weekApproved: number;
    totalApproved: number;
  }[];
};
