import { privateJson } from "@/lib/http";
import { z } from "zod";
import { requireUser } from "@/lib/auth/requestUser";
import { getEntry, updateEntry } from "@/lib/entries";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, HttpError } from "@/lib/http";
import { listPhotos } from "@/lib/photos";
import { deleteR2Object } from "@/lib/r2";
import { entryCreateSchema } from "@/lib/validations/entry";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  try {
    await requireUser(req);
    const entry = await getEntry(z.uuid().parse((await ctx.params).id));
    if (!entry) throw new HttpError("记录不存在", 404);
    return privateJson({ entry });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(req: Request, ctx: Context) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().parse((await ctx.params).id);
    const entry = await getEntry(id);
    if (!entry) throw new HttpError("记录不存在", 404);
    if (entry.user_id !== user.userId)
      throw new HttpError("只能删除自己的记录", 403);
    const photos = entry.photos ?? (await listPhotos(id));
    const { error } = await createAdminClient()
      .from("entries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.userId);
    if (error) throw error;
    await Promise.all(photos.map((photo) => deleteR2Object(photo.r2_key)));
    return privateJson({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(req: Request, ctx: Context) {
  try {
    const user = await requireUser(req);
    const id = z.uuid().parse((await ctx.params).id);
    const entry = await getEntry(id);
    if (!entry) throw new HttpError("记录不存在", 404);
    if (entry.user_id !== user.userId)
      throw new HttpError("只能编辑自己的记录", 403);
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = entryCreateSchema.parse({
      ...body,
      kind: body.kind ?? entry.kind,
    });
    if (parsed.kind !== entry.kind)
      throw new HttpError("不能更改记录类型", 400);
    return privateJson({
      entry: await updateEntry(user.userId, id, parsed),
    });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
