import { requestJson, jsonBody } from "@/lib/browser";
import { MAX_BYTES, type EntryPhoto } from "@/lib/photo-constants";

const TARGET_BYTES = 1_000_000;
const MAX_EDGE = 2048;

export function scaleToMaxEdge(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { width, height };
  const scale = maxEdge / edge;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImageFile(file: File): Promise<{
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
}> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = scaleToMaxEdge(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("无法处理这张图片");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const types = ["image/webp", "image/jpeg"] as const;
  let fallback: { blob: Blob; contentType: string } | null = null;
  for (const type of types) {
    for (let quality = 0.85; quality >= 0.5; quality -= 0.1) {
      const blob = await toBlob(canvas, type, Number(quality.toFixed(2)));
      if (!blob) break;
      if (blob.size <= TARGET_BYTES)
        return { blob, contentType: type, width, height };
      if (blob.size <= MAX_BYTES) fallback = { blob, contentType: type };
    }
  }
  if (fallback) return { ...fallback, width, height };
  throw new Error("图片压缩后仍超过 1.2MB，请换一张更小的图");
}

export async function uploadEntryPhoto(
  entryId: string,
  file: File,
  sort: number,
): Promise<EntryPhoto> {
  const compressed = await compressImageFile(file);
  const presign = await requestJson<{
    uploadUrl: string;
    r2Key: string;
    publicUrl: string;
    photoId: string;
    headers?: Record<string, string>;
  }>(
    "/api/photos/presign",
    jsonBody({
      entryId,
      contentType: compressed.contentType,
      bytes: compressed.blob.size,
      width: compressed.width,
      height: compressed.height,
    }),
  );
  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    body: compressed.blob,
    headers: presign.headers ?? { "Content-Type": compressed.contentType },
  });
  if (!put.ok) throw new Error("照片上传失败，请重试");
  const { photo } = await requestJson<{ photo: EntryPhoto }>(
    "/api/photos/confirm",
    jsonBody({
      entryId,
      photoId: presign.photoId,
      r2Key: presign.r2Key,
      publicUrl: presign.publicUrl,
      sort,
      width: compressed.width,
      height: compressed.height,
      bytes: compressed.blob.size,
      contentType: compressed.contentType,
    }),
  );
  return photo;
}
