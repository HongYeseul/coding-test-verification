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
  /** 여러 스터디에 든 사람도 한 번만 셉니다. */
  totalMembers: number;
  /** 서비스를 연 뒤 쌓인 전체 인증입니다. 그룹 칸의 `weekApproved`와 기간이 다릅니다. */
  totalApproved: number;
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
