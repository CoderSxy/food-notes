import { z } from 'zod';
import { requireUser } from '@/lib/auth/requestUser';
import { getEntry } from '@/lib/entries';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, HttpError } from '@/lib/http';
type Context = { params: Promise<{ id: string }> };
export async function GET(_req: Request, ctx: Context) {
  try {
    await requireUser();
    const entry = await getEntry(z.uuid().parse((await ctx.params).id));
    if (!entry) throw new HttpError('记录不存在', 404);
    return Response.json({ entry });
  } catch (error) { return apiError(error); }
}
export async function DELETE(_req: Request, ctx: Context) {
  try {
    const user = await requireUser();
    const id = z.uuid().parse((await ctx.params).id);
    const entry = await getEntry(id);
    if (!entry) throw new HttpError('记录不存在', 404);
    if (entry.user_id !== user.userId) throw new HttpError('只能删除自己的记录', 403);
    const { error } = await createAdminClient().from('entries').delete().eq('id', id).eq('user_id', user.userId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
