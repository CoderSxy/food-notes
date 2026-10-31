import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";

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

const PHOTO_SELECT =
  "id,entry_id,user_id,r2_key,public_url,sort,width,height,bytes,content_type,created_at";

const EXT_BY_TYPE: Record<AllowedContentType, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function buildObjectKey(
  userId: string,
  entryId: string,
  photoId: string,
  contentType: string,
): string {
  const ext = EXT_BY_TYPE[contentType as AllowedContentType];
  if (!ext) throw new HttpError("不支持的图片格式", 400);
  return `entries/${userId}/${entryId}/${photoId}.${ext}`;
}

export function assertKeyOwned(
  userId: string,
  entryId: string,
  photoId: string,
  key: string,
): void {
  const allowed = ALLOWED_CONTENT_TYPES.map((type) =>
    buildObjectKey(userId, entryId, photoId, type),
  );
  if (!allowed.includes(key)) throw new HttpError("照片路径无效", 400);
}

export function coverUrlFromPhotos(photos: EntryPhoto[]): string | null {
  if (!photos.length) return null;
  return (
    photos.find((photo) => photo.sort === 0)?.public_url ??
    photos[0]?.public_url ??
    null
  );
}

export function nextPhotoSort(photos: EntryPhoto[]): number {
  const used = new Set(photos.map((photo) => photo.sort));
  for (let sort = 0; sort < MAX_PHOTOS; sort++) {
    if (!used.has(sort)) return sort;
  }
  throw new HttpError("最多 3 张照片", 400);
}

export async function countPhotos(entryId: string): Promise<number> {
  const { count, error } = await createAdminClient()
    .from("entry_photos")
    .select("id", { count: "exact", head: true })
    .eq("entry_id", entryId);
  if (error) throw error;
  return count ?? 0;
}

export async function listPhotos(entryId: string): Promise<EntryPhoto[]> {
  const { data, error } = await createAdminClient()
    .from("entry_photos")
    .select(PHOTO_SELECT)
    .eq("entry_id", entryId)
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EntryPhoto[];
}

export async function listPhotosForEntries(
  entryIds: string[],
): Promise<EntryPhoto[]> {
  if (!entryIds.length) return [];
  const { data, error } = await createAdminClient()
    .from("entry_photos")
    .select(PHOTO_SELECT)
    .in("entry_id", entryIds)
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EntryPhoto[];
}

export async function getPhoto(id: string): Promise<EntryPhoto | null> {
  const { data, error } = await createAdminClient()
    .from("entry_photos")
    .select(PHOTO_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as EntryPhoto | null) ?? null;
}

export async function insertPhoto(row: {
  id: string;
  entry_id: string;
  user_id: string;
  r2_key: string;
  public_url: string;
  sort: number;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  content_type: string;
}): Promise<EntryPhoto> {
  const { data, error } = await createAdminClient()
    .from("entry_photos")
    .insert({
      id: row.id,
      entry_id: row.entry_id,
      user_id: row.user_id,
      r2_key: row.r2_key,
      public_url: row.public_url,
      sort: row.sort,
      width: row.width ?? null,
      height: row.height ?? null,
      bytes: row.bytes ?? null,
      content_type: row.content_type,
    })
    .select(PHOTO_SELECT)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new HttpError("照片位置已被占用，请重试", 400);
    throw error;
  }
  return data as EntryPhoto;
}

export async function deletePhotoRow(
  id: string,
  userId: string,
): Promise<EntryPhoto | null> {
  const { data, error } = await createAdminClient()
    .from("entry_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select(PHOTO_SELECT)
    .maybeSingle();
  if (error) throw error;
  return (data as EntryPhoto | null) ?? null;
}
