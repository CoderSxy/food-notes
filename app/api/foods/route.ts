import { requireUser } from '@/lib/auth/requestUser';
import { placeCreateSchema } from '@/lib/validations/entry';
import { createEntry } from '@/lib/entries';
import { listFoods } from '@/lib/foods';
import { apiError } from '@/lib/http';
export async function GET(_req: Request) {
  try { await requireUser(); return Response.json({ foods: await listFoods() }); }
  catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    // Missing kind is the legacy contract. Explicit item requests are rejected.
    const parsed = placeCreateSchema.parse({ ...body, kind: body.kind ?? 'place' });
    return Response.json({ food: await createEntry(user.userId, parsed) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
