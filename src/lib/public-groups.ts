/** 로그인 없이 볼 수 있는 값만 담습니다. 함수가 고른 필드 외에는 나가지 않습니다. */
export type GroupDirectoryEntry = {
  name: string;
  slug: string;
  memberCount: number;
  isPublic: boolean;
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
