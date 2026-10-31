import { z } from "zod";
import { requireUser } from "@/lib/auth/requestUser";
import { apiError, HttpError, privateJson } from "@/lib/http";
import { deletePhotoRow, getPhoto } from "@/lib/photos";
import { deleteR2Object } from "@/lib/r2";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Context) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().parse((await ctx.params).id);
    const photo = await getPhoto(id);
    if (!photo) throw new HttpError("照片不存在", 404);
    if (photo.user_id !== user.userId)
      throw new HttpError("只能删除自己的照片", 403);
    const deleted = await deletePhotoRow(id, user.userId);
    if (!deleted) throw new HttpError("照片不存在", 404);
    await deleteR2Object(deleted.r2_key);
    return privateJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
