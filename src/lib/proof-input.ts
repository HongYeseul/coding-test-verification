export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
export const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
export const PHOTO_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function normalizeInviteCode(value: string) {
  const code = value.trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{5}$/.test(code) ? code : null;
}

export function isPhotoPath(path: string, groupId: string, userId: string) {
  const prefix = `${groupId}/${userId}/`;
  return (
    path.startsWith(prefix) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/.test(
      path.slice(prefix.length),
    )
  );
}

export function photoError(
  file: { type: string; size: number },
  maxBytes = MAX_PHOTO_BYTES,
) {
  if (!Object.hasOwn(PHOTO_EXTENSIONS, file.type))
    return "JPG, PNG, WebP 사진만 올릴 수 있습니다.";
  if (file.size < 1 || file.size > maxBytes)
    return `사진은 ${maxBytes / 1024 / 1024}MB 이하로 올려주세요.`;
  return null;
}
