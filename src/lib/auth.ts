import { redirect } from "next/navigation";

import { loginPath } from "@/lib/auth-navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function getOptionalUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser(next = "/dashboard") {
  if (!isSupabaseConfigured()) {
    redirect("/?auth_error=configuration");
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(loginPath(next));
  }

  return { supabase, user };
}
