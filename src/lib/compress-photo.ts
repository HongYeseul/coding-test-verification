import {
  MAX_PHOTO_BYTES,
  MAX_SOURCE_PHOTO_BYTES,
  photoError,
} from "./proof-input.ts";

export const MAX_PHOTO_EDGE = 1920;
export const TARGET_PHOTO_BYTES = 500 * 1024;

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
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("이 브라우저에서는 사진을 처리할 수 없습니다.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, size.width, size.height);
    let compressed = await encode(canvas, "image/webp", 0.82);
    if (compressed.type !== "image/webp") {
      // WebP 인코딩을 지원하지 않는 브라우저는 투명 영역을 흰색으로 합성합니다.
      context.globalCompositeOperation = "destination-over";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size.width, size.height);
      compressed = await encode(canvas, "image/jpeg", 0.82);
    }
    if (compressed.size > TARGET_PHOTO_BYTES) {
      const smaller = await encode(canvas, compressed.type, 0.72);
      if (smaller.size < compressed.size) compressed = smaller;
    }
    // 작은 원본을 재인코딩해 더 커지는 경우는 원본을 그대로 사용합니다.
    if (
      file.size <= MAX_PHOTO_BYTES &&
      file.size <= compressed.size &&
      image.naturalWidth <= MAX_PHOTO_EDGE &&
      image.naturalHeight <= MAX_PHOTO_EDGE
    )
      return file;
    if (compressed.size > MAX_PHOTO_BYTES)
      throw new Error(
        "압축 후에도 사진이 너무 큽니다. 화면을 나누어 올려주세요.",
      );
    return compressed;
  } finally {
    URL.revokeObjectURL(url);
    image.src = "";
    canvas.width = 0;
    canvas.height = 0;
  }
}
