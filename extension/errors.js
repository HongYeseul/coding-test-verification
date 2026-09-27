/**
 * 사용자에게 보일 문장으로 바꿉니다. 크롬·Supabase·GitHub가 준 영어 원문은 그대로 보이지
 * 않습니다 — 무엇을 하면 되는지 말하지 않고, 제품 말투와도 어긋납니다.
 * 우리가 지은 문장(한글이 있는 것)은 그대로 두고, 아니면 부르는 쪽이 준 문장을 씁니다.
 */
export function readable(error, fallback) {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  // fetch 자체가 실패하면 브라우저가 TypeError를 던집니다(`Failed to fetch`).
  if (error instanceof TypeError && /fetch|network/i.test(message))
    return "인터넷 연결을 확인하고 다시 시도해주세요.";
  return /[가-힣]/.test(message) ? message : fallback;
}
