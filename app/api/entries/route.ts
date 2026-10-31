import { privateJson } from "@/lib/http";
import { parseEntryQuery } from "@/lib/validations/entry-query";
import { requireUser } from "@/lib/auth/requestUser";
import { entryCreateSchema } from "@/lib/validations/entry";
import { createEntry, listEntryPage } from "@/lib/entries";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return privateJson(
      await listEntryPage(
        user.userId,
        parseEntryQuery(new URL(req.url).searchParams),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const parsed = entryCreateSchema.parse(await req.json());
    return privateJson(
      { entry: await createEntry(user.userId, parsed) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
