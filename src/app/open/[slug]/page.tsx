import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getOptionalUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { PublicGroupBoard } from "@/lib/public-groups";

/**
 * 정렬은 표시 규칙이라 함수가 아니라 화면에서 정합니다.
 * 그룹 화면의 주간 현황과 같은 기준을 씁니다.
 */
function rankedMembers(members: PublicGroupBoard["members"]) {
  const sorted = [...members].sort(
    (left, right) =>
      right.weekApproved - left.weekApproved ||
      right.totalApproved - left.totalApproved ||
      left.displayName.localeCompare(right.displayName, "ko-KR"),
  );
  let rank = 0;
  let previous = "";
  return sorted.map((member, index) => {
    const key = `${member.weekApproved}/${member.totalApproved}`;
    if (key !== previous) {
      rank = index + 1;
      previous = key;
    }
    return { ...member, rank };
  });
}

export default async function PublicGroupBoardPage({
  params,
}: PageProps<"/open/[slug]">) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  // 비공개 그룹은 함수가 아무것도 돌려주지 않습니다.
  const { data } = await supabase.rpc("get_public_group_board", {
    group_slug: slug,
  });
  const board = data as PublicGroupBoard | null;
  if (!board) notFound();

  const user = await getOptionalUser();
  const members = rankedMembers(board.members);
  const weekTotal = members.reduce(
    (total, member) => total + member.weekApproved,
    0,
  );
  // 막대는 선두를 기준으로 한 상대 길이입니다.
  const leadWeek = members[0]?.weekApproved ?? 0;

  return (
    <AppShell
      context={board.name}
      actions={
        user ? (
          <Link href="/dashboard" className="text-[13px] text-sub">
            내 그룹
          </Link>
        ) : (
          <Link href="/" className="text-[13px] text-sub">
            로그인
          </Link>
        )
      }
    >
      <header className="mb-6">
        <h1>{board.name}</h1>
        <p className="mt-1 text-[15px] text-sub tabular-nums">
          멤버 {board.memberCount}명
          {weekTotal > 0 && ` · 이번 주 ${weekTotal}번 인증`}
        </p>
      </header>

      {members.length ? (
        <ol className="rounded-xl border border-line">
          {members.map((member) => (
            <li
              key={`${member.rank}-${member.displayName}`}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
            >
              <span
                className={`text-[15px] tabular-nums ${
                  member.rank === 1 && member.weekApproved > 0
                    ? "font-[650] text-brand"
                    : "text-sub"
                }`}
              >
                {member.rank}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold">
                  {member.displayName}
                </span>
                {/* 숫자를 읽지 않아도 이번 주 격차가 보이도록 둔 막대입니다. */}
                <span
                  aria-hidden="true"
                  className="mt-1.5 block h-1 w-full max-w-60 rounded-full bg-soft"
                >
                  <span
                    className="block h-1 rounded-full bg-brand"
                    style={{
                      width: leadWeek
                        ? `${Math.round((member.weekApproved / leadWeek) * 100)}%`
                        : "0%",
                    }}
                  />
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[17px] font-[650] tabular-nums">
                  {member.weekApproved}번
                </span>
                <span className="mt-0.5 block text-[12px] text-sub tabular-nums">
                  누적 {member.totalApproved}번
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-line px-5 py-10 text-center text-[13px] text-sub">
          아직 멤버가 없습니다.
        </p>
      )}

      <p className="mt-3 text-[12px] text-sub">
        이번 주 인정된 풀이가 많은 순입니다. 한 주는 월요일에 시작합니다.
      </p>

      <p className="mt-7 text-[13px] text-sub">
        공개되는 값은 닉네임과 인정된 풀이 건수뿐입니다. 인증 사진·문제 링크·검수
        내용은 그룹 멤버만 볼 수 있습니다.{" "}
        <Link href="/" className="underline">
          다른 스터디 둘러보기
        </Link>
      </p>
    </AppShell>
  );
}
