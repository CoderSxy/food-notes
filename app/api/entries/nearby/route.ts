import { privateJson } from "@/lib/http";
import { ownerScopeSchema } from "@/lib/validations/entry-query";
import { requireUser } from "@/lib/auth/requestUser";
import { nearbySchema } from "@/lib/validations/entry";
import { nearbyPlaceEntries } from "@/lib/entries";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const input = nearbySchema.parse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    return privateJson({
      entries: await nearbyPlaceEntries(
        input,
        input.radiusKm,
        new URL(req.url).searchParams.has("scope") &&
          ownerScopeSchema.parse(new URL(req.url).searchParams.get("scope")) ===
            "mine"
          ? user.userId
          : undefined,
      ),
    });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
