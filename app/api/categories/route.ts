import { z } from 'zod';
import { requireUser } from '@/lib/auth/requestUser';
import { listRootCategories, listChildCategories } from '@/lib/categories';
import { apiError } from '@/lib/http';
export async function GET(req: Request) {
  try {
    await requireUser();
    const parent = new URL(req.url).searchParams.get('parent_id');
    const categories = parent === null ? await listRootCategories() : await listChildCategories(z.uuid().parse(parent));
    return Response.json({ categories });
  } catch (error) { return apiError(error); }
}
