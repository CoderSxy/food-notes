import { requireUser } from "@/lib/auth/requestUser";
import { getEntry } from "@/lib/entries";
import { apiError, HttpError, privateJson } from "@/lib/http";
import { buildObjectKey, countPhotos, MAX_PHOTOS } from "@/lib/photos";
import { isR2Configured, presignPutObject, publicUrlForKey } from "@/lib/r2";
import { photoPresignSchema } from "@/lib/validations/photo";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (!isR2Configured()) throw new HttpError("图片存储未配置", 503);
    const body = photoPresignSchema.parse(await req.json());
    const entry = await getEntry(body.entryId);
    if (!entry) throw new HttpError("记录不存在", 404);
    if (entry.user_id !== user.userId)
      throw new HttpError("只能为自己的记录添加照片", 403);
    if ((await countPhotos(entry.id)) >= MAX_PHOTOS)
      throw new HttpError("最多 3 张照片", 400);
    const photoId = crypto.randomUUID();
    const r2Key = buildObjectKey(
      user.userId,
      entry.id,
      photoId,
      body.contentType,
    );
    const publicUrl = publicUrlForKey(r2Key);
    const uploadUrl = await presignPutObject(r2Key, body.contentType);
    return privateJson({
      uploadUrl,
      r2Key,
      publicUrl,
      photoId,
      headers: { "Content-Type": body.contentType },
    });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
