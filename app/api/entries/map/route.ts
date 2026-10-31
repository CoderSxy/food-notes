import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { listMapPoints } from "@/lib/entries";
import { parseMapQuery } from "@/lib/validations/entry-query";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return privateJson(
      await listMapPoints(
        user.userId,
        parseMapQuery(new URL(req.url).searchParams),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
