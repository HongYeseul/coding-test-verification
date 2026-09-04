import { NextResponse } from "next/server";

import { loginPath, safeNextPath } from "@/lib/auth-navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  const failure = (reason: string) =>
    NextResponse.redirect(new URL(loginPath(next, reason), requestUrl));

  if (!isSupabaseConfigured()) {
    return failure("configuration");
  }
  if (requestUrl.searchParams.has("error")) {
    return failure("denied");
  }
  if (!code) {
    return failure("exchange");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return failure("exchange");
  }

  return NextResponse.redirect(new URL(next, requestUrl));
}
