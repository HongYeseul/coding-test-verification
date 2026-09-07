"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { getRequiredText, withStatus } from "@/lib/form";
import { normalizeBio, normalizeDisplayName } from "@/lib/profile";

const PROFILE_PATH = "/settings/profile";

export async function updateProfileAction(formData: FormData) {
  const displayName = normalizeDisplayName(
    getRequiredText(formData, "displayName"),
  );
  const bio = normalizeBio(getRequiredText(formData, "bio"));

  if (!displayName) {
    redirect(withStatus(PROFILE_PATH, "error", "닉네임을 입력해주세요."));
  }

  const { supabase, user } = await requireUser(PROFILE_PATH);
  // github_login과 avatar_url은 컬럼 단위 권한으로 막혀 있어 여기서 보낼 수 없습니다.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, bio: bio || null })
    .eq("id", user.id);

  if (error) {
    redirect(withStatus(PROFILE_PATH, "error", "프로필을 저장하지 못했습니다."));
  }

  revalidatePath(PROFILE_PATH);
  revalidatePath("/dashboard");
  redirect(withStatus(PROFILE_PATH, "message", "프로필을 저장했습니다."));
}
