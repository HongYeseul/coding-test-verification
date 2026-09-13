import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createProofRecord } from "@/lib/proof-record";
import {
  getSupabaseConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

/**
 * 확장 프로그램이 인증 기록을 등록하는 창구입니다.
 * 화면은 서버 액션을 쓰지만 그 주소는 빌드마다 바뀌므로 확장은 이 경로를 씁니다.
 * 쿠키는 보지 않고 Bearer 토큰만 받습니다.
 */
function corsHeaders(origin: string | null) {
  // 확장 오리진은 설치할 때마다 아이디가 달라 목록으로 고정할 수 없습니다.
  // 대신 쿠키를 전혀 쓰지 않아, 토큰이 없는 요청은 오리진과 무관하게 거절됩니다.
  const allowed = origin?.startsWith("chrome-extension://") ? origin : null;
  return {
    ...(allowed ? { "Access-Control-Allow-Origin": allowed } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const headers = {
    ...corsHeaders(request.headers.get("origin")),
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  };
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers });

  if (!isSupabaseConfigured())
    return json({ error: "서버 설정이 끝나지 않았습니다." }, 503);

  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return json({ error: "로그인이 필요합니다." }, 401);

  const config = getSupabaseConfig();
  const supabase = createSupabaseClient(config.url, config.publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  // 확장이 보낸 토큰은 믿을 수 없으므로 Auth 서버에 직접 확인합니다.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user)
    return json({ error: "로그인이 만료됐습니다. 다시 연결해주세요." }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "요청 형식을 확인해주세요." }, 400);
  }
  const text = (value: unknown) => (typeof value === "string" ? value : "");

  const result = await createProofRecord(supabase, data.user.id, {
    groupId: text(body.groupId),
    evidencePath: text(body.evidencePath),
    recordKey: text(body.recordKey),
    title: text(body.title),
    problemUrl: text(body.problemUrl),
    solutionCode: text(body.solutionCode),
  });
  if (result.error) return json({ error: result.error }, 400);
  return json({ autoApproved: Boolean(result.autoApproved) }, 201);
}
