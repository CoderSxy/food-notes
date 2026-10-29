import { requireUser } from '@/lib/auth/requestUser';
import { nearbySchema } from '@/lib/validations/entry';
import { nearbyPlaceEntries } from '@/lib/entries';
import { apiError } from '@/lib/http';
export async function GET(req: Request) {
  try {
    await requireUser();
    const input = nearbySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return Response.json({ entries: await nearbyPlaceEntries(input, input.radiusKm) });
  } catch (error) { return apiError(error); }
}
