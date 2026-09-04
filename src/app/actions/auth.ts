"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { safeNextPath, loginPath } from "@/lib/auth-navigation";
import { getRequiredText } from "@/lib/form";

export async function signOutAction(formData: FormData) {
  const { supabase } = await requireUser();
  const next = getRequiredText(formData, "next");
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error)
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("로그아웃하지 못했습니다. 다시 시도해주세요."),
    );
  redirect(next ? loginPath(safeNextPath(next)) : "/");
}
