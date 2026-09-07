export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_BIO_LENGTH = 80;

/**
 * 지워야 하는 보이지 않는 문자입니다. 제어문자는 DB CHECK에서도 막지만,
 * 글자 순서를 뒤집어 다른 멤버를 사칭할 수 있는 양방향 제어문자는 여기서만 지웁니다.
 * 탭·줄바꿈(U+0009~U+000D)은 공백으로 다루므로 빼고, 이모지 결합에 쓰이는 ZWJ도 남깁니다.
 */
const INVISIBLE =
  /[\u0000-\u0008\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

/** 닉네임과 한 줄 소개에서 보이지 않는 문자를 지우고 공백을 한 칸으로 모읍니다. */
function clean(value: string, limit: number) {
  return value
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, limit);
}

export function normalizeDisplayName(value: string) {
  return clean(value, MAX_DISPLAY_NAME_LENGTH);
}

export function normalizeBio(value: string) {
  return clean(value, MAX_BIO_LENGTH);
}

/** GitHub 아이디는 auth.identities에서만 채우므로 화면에 그릴 때 형식만 확인합니다. */
export function githubHandle(login: string | null | undefined) {
  return login && /^[a-z0-9](?:-?[a-z0-9]){0,38}$/.test(login) ? login : null;
}
