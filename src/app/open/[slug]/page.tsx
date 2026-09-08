import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getOptionalUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { PublicGroupBoard } from "@/lib/public-groups";

function weekLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(`${value}T00:00:00+09:00`));
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
        <p className="text-[13px] text-sub">공개 리더보드</p>
        <h1 className="mt-1">{board.name}</h1>
        <p className="mt-1 text-[15px] text-sub">
          멤버 {board.memberCount}명 · 이번 주는 {weekLabel(board.weekStart)}부터
        </p>
      </header>

      {board.members.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-sub">
                <th scope="col" className="px-4 py-3 font-normal">
                  순위
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  멤버
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  이번 주
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  누적
                </th>
              </tr>
            </thead>
            <tbody>
              {board.members.map((member, index) => (
                <tr
                  key={`${member.displayName}-${index}`}
                  className="border-b border-line last:border-b-0"
                >
                  <td className="px-4 py-3 text-[13px] text-sub tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {member.displayName}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {member.weekApproved}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {member.totalApproved}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-line px-5 py-10 text-center text-[13px] text-sub">
          아직 인정된 풀이가 없습니다.
        </p>
      )}

      <p className="mt-4 text-[13px] text-sub">
        공개되는 값은 닉네임과 인정된 풀이 건수뿐입니다. 인증 사진·문제 링크·검수
        내용은 그룹 멤버만 볼 수 있습니다.
      </p>

      <p className="mt-6 text-[13px] text-sub">
        <Link href="/" className="underline">
          다른 스터디 둘러보기
        </Link>
      </p>
    </AppShell>
  );
}
