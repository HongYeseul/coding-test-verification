export function safeNextPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/dashboard";
  }

  const base = new URL("https://coding-proof.invalid");
  try {
    const destination = new URL(value, base);
    if (
      destination.pathname === "/" ||
      destination.origin !== base.origin ||
      destination.pathname.startsWith("/auth/")
    ) {
      return "/dashboard";
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/dashboard";
  }
}

export function loginPath(next: string, error?: string) {
  const query = new URLSearchParams({ next: safeNextPath(next) });
  if (error) query.set("auth_error", error);
  return `/?${query}`;
}

export function authErrorMessage(error: string | undefined) {
  if (!error) return undefined;
  if (error === "configuration") return "로그인 서비스 연결을 준비 중입니다.";
  if (error === "denied")
    return "GitHub 로그인이 취소되었습니다. 다시 로그인해주세요.";
  if (error === "signout") return "로그아웃하지 못했습니다. 다시 시도해주세요.";
  return "로그인 연결이 만료되었거나 완료되지 않았습니다. 다시 로그인해주세요.";
}
