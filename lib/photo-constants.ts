export const MAX_PHOTOS = 3;
export const MAX_BYTES = 1_200_000;
export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export type EntryPhoto = {
  id: string;
  entry_id: string;
  user_id: string;
  r2_key: string;
  public_url: string;
  sort: number;
  width: number | null;
  height: number | null;
  bytes: number | null;
  content_type: string;
  created_at: string;
};

export function nextPhotoSort(photos: Pick<EntryPhoto, "sort">[]): number {
  const used = new Set(photos.map((photo) => photo.sort));
  for (let sort = 0; sort < MAX_PHOTOS; sort++) {
    if (!used.has(sort)) return sort;
  }
  throw new Error("最多 3 张照片");
}
