import { CONFIG } from "./config.js";

const SESSION_KEY = "dojang.session";

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE 검증값과 그 해시입니다. supabase-js가 보내는 것과 같은 형식을 씁니다. */
async function createPkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(64)));
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

async function tokenRequest(grant, body) {
  const response = await fetch(
    `${CONFIG.supabaseUrl}/auth/v1/token?grant_type=${grant}`,
    {
      method: "POST",
      headers: {
        apikey: CONFIG.supabasePublishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.msg || "로그인에 실패했습니다.");
  }
  return data;
}

async function store(session) {
  const saved = {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    // 만료 30초 전부터 미리 갱신해 등록 도중에 끊기지 않게 합니다.
    expiresAt: Date.now() + (session.expires_in ?? 3600) * 1000 - 30_000,
  };
  await chrome.storage.local.set({ [SESSION_KEY]: saved });
  return saved;
}

/**
 * GitHub 로그인 창을 띄우고 받은 코드를 토큰 응답으로 바꿉니다.
 * scopes를 주면 Supabase가 GitHub에 그 권한을 더 청합니다.
 */
async function authorize(scopes) {
  const redirectTo = chrome.identity.getRedirectURL();
  const { verifier, challenge } = await createPkce();
  const url =
    `${CONFIG.supabaseUrl}/auth/v1/authorize?provider=github` +
    `&redirect_to=${encodeURIComponent(redirectTo)}` +
    `&code_challenge=${encodeURIComponent(challenge)}` +
    `&code_challenge_method=s256` +
    (scopes ? `&scopes=${encodeURIComponent(scopes)}` : "");

  const callback = await chrome.identity.launchWebAuthFlow({
    url,
    interactive: true,
  });
  const returned = new URL(callback);
  // 오류는 질의값으로도 프래그먼트로도 올 수 있습니다.
  const params = new URLSearchParams(
    returned.search.slice(1) || returned.hash.slice(1),
  );
  const failure = params.get("error_description") || params.get("error");
  if (failure) throw new Error(failure);
  const code = params.get("code");
  if (!code) throw new Error("로그인 응답에 코드가 없습니다.");

  return tokenRequest("pkce", {
    auth_code: code,
    code_verifier: verifier,
  });
}

/** GitHub 로그인 창을 띄우고 받은 코드를 세션으로 바꿉니다. */
export async function signIn() {
  return store(await authorize());
}

/**
 * GitHub 권한을 더 받아 로그인하고, GitHub가 내준 토큰을 돌려줍니다.
 * Supabase는 이 토큰을 로그인 응답에 한 번 실어 줄 뿐 보관하지 않으므로 받는 쪽이
 * 간직해야 합니다. 도장 세션도 새로 받은 것으로 바꿉니다.
 */
export async function signInWithScopes(scopes) {
  const session = await authorize(scopes);
  await store(session);
  if (!session.provider_token) throw new Error("GitHub 권한을 받지 못했습니다.");
  return session.provider_token;
}

export async function signOut() {
  await chrome.storage.local.remove(SESSION_KEY);
}

/** 저장된 세션을 돌려주고, 만료가 가까우면 먼저 갱신합니다. */
export async function getSession() {
  const stored = (await chrome.storage.local.get(SESSION_KEY))[SESSION_KEY];
  if (!stored?.refreshToken) return null;
  if (stored.expiresAt > Date.now()) return stored;
  try {
    return await store(
      await tokenRequest("refresh_token", { refresh_token: stored.refreshToken }),
    );
  } catch {
    await signOut();
    return null;
  }
}

/** 액세스 토큰의 sub가 곧 사용자 아이디입니다. 서명 검증은 서버와 RLS가 합니다. */
export function userIdFrom(accessToken) {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  try {
    return JSON.parse(json).sub ?? null;
  } catch {
    return null;
  }
}
