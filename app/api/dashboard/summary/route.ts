import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { getEntrySummary } from "@/lib/entries";
import { ownerScopeSchema } from "@/lib/validations/entry-query";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const scope = ownerScopeSchema.parse(
      new URL(req.url).searchParams.get("scope") ?? undefined,
    );
    return privateJson(await getEntrySummary(user.userId, scope), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
