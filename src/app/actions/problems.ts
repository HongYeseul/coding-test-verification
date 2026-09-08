"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getRequiredText, withStatus } from "@/lib/form";
import { problemLink } from "@/lib/proof-input";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 그룹이 정한 문제 제목을 저장합니다. 비우면 기록에 적힌 제목으로 되돌립니다. */
export async function updateProblemTitleAction(formData: FormData) {
  const groupSlug = getRequiredText(formData, "groupSlug");
  const problemUrl = getRequiredText(formData, "problemUrl");
  // 줄바꿈과 제어문자를 공백 한 칸으로 모아 DB CHECK와 같은 모양으로 맞춥니다.
  const title = getRequiredText(formData, "title").replace(/\s+/gu, " ").trim();
  const groupPath = SLUG_PATTERN.test(groupSlug)
    ? `/groups/${groupSlug}`
    : "/dashboard";

  // 저장하는 링크는 목록이 문제를 묶는 기준과 같은 정규화된 주소여야 합니다.
  const link = problemLink(problemUrl);
  if (!link || title.length > 160) {
    redirect(withStatus(groupPath, "error", "문제 제목을 확인해주세요."));
  }

  const { supabase, user } = await requireUser(groupPath);
  const { data: group } = await supabase
    .from("groups")
    .select("id")
    .eq("slug", groupSlug)
    .maybeSingle();
  const { data: member } = group
    ? await supabase
        .from("group_members")
        .select("role, status")
        .eq("group_id", group.id)
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  if (
    !group ||
    member?.status !== "ACTIVE" ||
    !["OWNER", "REVIEWER"].includes(member.role)
  ) {
    redirect(
      withStatus(
        groupPath,
        "error",
        "소유자와 검수자만 문제 제목을 정할 수 있습니다.",
      ),
    );
  }

  // 제목을 비우면 행을 지웁니다. 행이 있다는 것은 그룹이 제목을 정했다는 뜻입니다.
  const { error } = title
    ? await supabase.from("group_problem_titles").upsert({
        group_id: group.id,
        url: link.url,
        title,
        updated_by: user.id,
      })
    : await supabase
        .from("group_problem_titles")
        .delete()
        .eq("group_id", group.id)
        .eq("url", link.url);

  if (error) {
    redirect(withStatus(groupPath, "error", "문제 제목을 저장하지 못했습니다."));
  }

  revalidatePath(groupPath);
  redirect(
    withStatus(
      groupPath,
      "message",
      title ? "문제 제목을 정했습니다." : "문제 제목을 지웠습니다.",
    ),
  );
}
