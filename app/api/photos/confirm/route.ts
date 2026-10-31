import { requireUser } from "@/lib/auth/requestUser";
import { getEntry } from "@/lib/entries";
import { apiError, HttpError, privateJson } from "@/lib/http";
import {
  assertKeyOwned,
  countPhotos,
  insertPhoto,
  MAX_PHOTOS,
} from "@/lib/photos";
import { isR2Configured, publicUrlForKey } from "@/lib/r2";
import { photoConfirmSchema } from "@/lib/validations/photo";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (!isR2Configured()) throw new HttpError("图片存储未配置", 503);
    const body = photoConfirmSchema.parse(await req.json());
    const entry = await getEntry(body.entryId);
    if (!entry) throw new HttpError("记录不存在", 404);
    if (entry.user_id !== user.userId)
      throw new HttpError("只能为自己的记录添加照片", 403);
    assertKeyOwned(user.userId, entry.id, body.photoId, body.r2Key);
    const publicUrl = publicUrlForKey(body.r2Key);
    if ((await countPhotos(entry.id)) >= MAX_PHOTOS)
      throw new HttpError("最多 3 张照片", 400);
    const photo = await insertPhoto({
      id: body.photoId,
      entry_id: entry.id,
      user_id: user.userId,
      r2_key: body.r2Key,
      public_url: publicUrl,
      sort: body.sort,
      width: body.width ?? null,
      height: body.height ?? null,
      bytes: body.bytes ?? null,
      content_type: body.contentType,
    });
    return privateJson({ photo });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
