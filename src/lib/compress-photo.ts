import {
  MAX_PHOTO_BYTES,
  MAX_SOURCE_PHOTO_BYTES,
  photoError,
} from "./proof-input.ts";

export const MAX_PHOTO_EDGE = 1920;
export const TARGET_PHOTO_BYTES = 150 * 1024;

export function photoDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 40_000_000 ||
    Math.max(width, height) > 16384
  ) {
    throw new Error(
      "사진 해상도가 너무 크거나 올바르지 않습니다. 화면을 나누어 올려주세요.",
    );
  }
  const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(
              new Error(
                "사진을 압축하지 못했습니다. 다른 사진을 선택해주세요.",
              ),
            ),
      type,
      quality,
    );
  });
}

export async function compressPhoto(file: File): Promise<Blob> {
  const validationError = photoError(file, MAX_SOURCE_PHOTO_BYTES);
  if (validationError) throw new Error(validationError);
  const image = new Image();
  const url = URL.createObjectURL(file);
  const canvas = document.createElement("canvas");
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        "사진을 읽을 수 없습니다. 정상적인 JPG, PNG, WebP 파일을 선택해주세요.",
      );
    }
    const size = photoDimensions(image.naturalWidth, image.naturalHeight);
    if (
      file.size <= TARGET_PHOTO_BYTES &&
      image.naturalWidth <= MAX_PHOTO_EDGE &&
      image.naturalHeight <= MAX_PHOTO_EDGE
    )
      return file;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("이 브라우저에서는 사진을 처리할 수 없습니다.");
    let compressed: Blob | undefined;
    let type = "image/webp";
    let previousEdge = 0;
    outer: for (const maxEdge of [1920, 1600, 1280]) {
      const edge = Math.min(maxEdge, Math.max(size.width, size.height));
      if (edge === previousEdge) continue;
      previousEdge = edge;
      const scale = edge / Math.max(size.width, size.height);
      canvas.width = Math.max(1, Math.round(size.width * scale));
      canvas.height = Math.max(1, Math.round(size.height * scale));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      // 투명한 스크린샷도 밝은 배경에서 읽을 수 있도록 합성합니다.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.76, 0.66]) {
        let candidate = await encode(canvas, type, quality);
        if (type === "image/webp" && candidate.type !== type) {
          type = "image/jpeg";
          candidate = await encode(canvas, type, quality);
        }
        if (candidate.type !== type || candidate.size < 1)
          throw new Error("이 브라우저에서는 사진을 압축할 수 없습니다.");
        if (!compressed || candidate.size < compressed.size)
          compressed = candidate;
        if (compressed.size <= TARGET_PHOTO_BYTES) break outer;
      }
    }
    // 작은 원본을 재인코딩해 더 커지는 경우는 원본을 그대로 사용합니다.
    if (
      file.size <= MAX_PHOTO_BYTES &&
      file.size <= (compressed?.size ?? Infinity) &&
      image.naturalWidth <= MAX_PHOTO_EDGE &&
      image.naturalHeight <= MAX_PHOTO_EDGE
    )
      return file;
    if (!compressed || compressed.size > MAX_PHOTO_BYTES)
      throw new Error(
        "압축 후에도 300KB를 초과합니다. 문제명·아이디·통과 결과가 보이도록 필요한 부분만 잘라 다시 선택해주세요.",
      );
    return compressed;
  } finally {
    URL.revokeObjectURL(url);
    image.src = "";
    canvas.width = 0;
    canvas.height = 0;
  }
}
