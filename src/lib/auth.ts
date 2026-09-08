import { redirect } from "next/navigation";

import { loginPath } from "@/lib/auth-navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** 화면 표시에 필요한 최소한의 값입니다. 권한 판단은 언제나 서버와 RLS가 합니다. */
export type SessionUser = {
  id: string;
  email: string | null;
  githubUserName: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * getUser()는 호출할 때마다 Auth 서버에 왕복합니다.
 * 이 프로젝트는 비대칭 서명 키(JWKS에 ES256)를 쓰므로 getClaims()가 JWKS로
 * 로컬 검증만 하고 왕복이 사라집니다. 대칭 키로 바뀌면 getClaims()도 서버에
 * 물어보므로 어느 쪽이든 getUser()보다 느려지지 않습니다.
 */
async function readUser(
  supabase: SupabaseServerClient,
): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || typeof claims?.sub !== "string") {
    return null;
  }

  // user_metadata는 사용자가 바꿀 수 있으므로 표시 용도로만 씁니다.
  const metadata = claims.user_metadata as { user_name?: unknown } | undefined;
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    githubUserName:
      typeof metadata?.user_name === "string" ? metadata.user_name : null,
  };
}

export async function getOptionalUser() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();
  return readUser(supabase);
}

export async function requireUser(next = "/dashboard") {
  if (!isSupabaseConfigured()) {
    redirect("/?auth_error=configuration");
  }

  const supabase = await createClient();
  const user = await readUser(supabase);

  if (!user) {
    redirect(loginPath(next));
  }

  return { supabase, user };
}
