import { requireUser } from '@/lib/auth/requestUser';
import { entryCreateSchema, entryKindSchema } from '@/lib/validations/entry';
import { createEntry, listEntries } from '@/lib/entries';
import { apiError } from '@/lib/http';
export async function GET(req: Request) {
  try {
    await requireUser();
    const kind = entryKindSchema.optional().parse(new URL(req.url).searchParams.get('kind') ?? undefined);
    return Response.json({ entries: await listEntries({ kind }) });
  } catch (error) { return apiError(error); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = entryCreateSchema.parse(await req.json());
    return Response.json({ entry: await createEntry(user.userId, parsed) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
