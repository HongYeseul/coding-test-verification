"use server";

import { createHash, randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getRequiredText, withStatus } from "@/lib/form";
import { requireUser } from "@/lib/auth";
import { getSiteUrl } from "@/lib/supabase/config";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createGroupAction(formData: FormData) {
  const name = getRequiredText(formData, "name");
  const slug = getRequiredText(formData, "slug").toLowerCase();

  if (name.length < 1 || name.length > 60 || !SLUG_PATTERN.test(slug)) {
    redirect(
      withStatus("/dashboard", "error", "그룹 이름과 주소를 확인해주세요."),
    );
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_group", {
    group_name: name,
    group_slug: slug,
  });

  if (error) {
    const message =
      error.code === "23505"
        ? "이미 사용 중인 그룹 주소입니다."
        : "그룹을 만들지 못했습니다.";
    redirect(withStatus("/dashboard", "error", message));
  }

  revalidatePath("/dashboard");
  redirect(withStatus(`/groups/${slug}`, "message", "그룹을 만들었습니다."));
}

export async function createInvitationAction(formData: FormData) {
  const groupId = getRequiredText(formData, "groupId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const targetType = getRequiredText(formData, "targetType");
  const target = getRequiredText(formData, "target").toLowerCase();
  const groupPath = SLUG_PATTERN.test(groupSlug)
    ? `/groups/${groupSlug}`
    : "/dashboard";

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target);
  const validGithubLogin = /^(?!-)(?!.*--)[a-z0-9-]{1,39}(?<!-)$/.test(target);

  if (
    !UUID_PATTERN.test(groupId) ||
    !(
      (targetType === "email" && validEmail) ||
      (targetType === "github" && validGithubLogin)
    )
  ) {
    redirect(withStatus(groupPath, "error", "초대 대상을 확인해주세요."));
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_group_invitation", {
    target_group_id: groupId,
    invitation_token_hash: tokenHash,
    invitation_target_email: targetType === "email" ? target : null,
    invitation_target_github_login: targetType === "github" ? target : null,
    invitation_expires_at: expiresAt,
  });

  if (error) {
    redirect(withStatus(groupPath, "error", "초대 링크를 만들지 못했습니다."));
  }

  revalidatePath(groupPath);
  const invitationUrl = `${getSiteUrl()}/invite/${token}`;
  redirect(`${groupPath}?invite=${encodeURIComponent(invitationUrl)}`);
}

export async function acceptInvitationAction(formData: FormData) {
  const token = getRequiredText(formData, "token");

  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    redirect(withStatus("/dashboard", "error", "유효하지 않은 초대입니다."));
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { supabase } = await requireUser(`/invite/${token}`);
  const { error } = await supabase.rpc("accept_group_invitation", {
    invitation_token_hash: tokenHash,
  });

  if (error) {
    redirect(
      withStatus(
        `/invite/${token}`,
        "error",
        "초대를 수락하지 못했습니다. 대상 계정과 만료 여부를 확인해주세요.",
      ),
    );
  }

  revalidatePath("/dashboard");
  redirect(
    withStatus(
      "/dashboard",
      "message",
      "초대를 수락했습니다. 그룹 소유자의 승인을 기다려주세요.",
    ),
  );
}

export async function approveMembershipAction(formData: FormData) {
  const groupId = getRequiredText(formData, "groupId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const userId = getRequiredText(formData, "userId");
  const groupPath = SLUG_PATTERN.test(groupSlug)
    ? `/groups/${groupSlug}`
    : "/dashboard";

  if (!UUID_PATTERN.test(groupId) || !UUID_PATTERN.test(userId)) {
    redirect(withStatus(groupPath, "error", "승인 대상을 확인해주세요."));
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("approve_group_member", {
    target_group_id: groupId,
    target_user_id: userId,
  });

  if (error) {
    redirect(withStatus(groupPath, "error", "멤버를 승인하지 못했습니다."));
  }

  revalidatePath(groupPath);
  redirect(withStatus(groupPath, "message", "멤버 가입을 승인했습니다."));
}

export async function setMemberRoleAction(formData: FormData) {
  const groupId = getRequiredText(formData, "groupId");
  const groupSlug = getRequiredText(formData, "groupSlug");
  const userId = getRequiredText(formData, "userId");
  const role = getRequiredText(formData, "role");
  if (
    !UUID_PATTERN.test(groupId) ||
    !UUID_PATTERN.test(userId) ||
    !SLUG_PATTERN.test(groupSlug) ||
    !["MEMBER", "REVIEWER"].includes(role)
  ) {
    redirect(
      withStatus("/dashboard", "error", "역할 변경 대상을 확인해주세요."),
    );
  }
  const groupPath = `/groups/${groupSlug}`;
  const { supabase, user } = await requireUser();
  const { data: membership } = await supabase
    .from("group_members")
    .select("role, status")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membership?.status !== "ACTIVE" || membership.role !== "OWNER") {
    redirect(
      withStatus(
        "/dashboard",
        "error",
        "그룹 소유자만 역할을 변경할 수 있습니다.",
      ),
    );
  }
  const { error } = await supabase.rpc("set_group_member_role", {
    target_group_id: groupId,
    target_user_id: userId,
    member_role: role,
  });
  if (error)
    redirect(withStatus(groupPath, "error", "역할을 변경하지 못했습니다."));
  revalidatePath(groupPath);
  redirect(withStatus(groupPath, "message", "멤버 역할을 변경했습니다."));
}
