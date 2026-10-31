import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { nearbySchema } from "@/lib/validations/food";
import { nearbyFoods } from "@/lib/foods";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const input = nearbySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return privateJson({ foods: await nearbyFoods(input, input.radiusKm) });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
