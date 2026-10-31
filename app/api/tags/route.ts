import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const q = (new URL(req.url).searchParams.get("q") || "")
      .trim()
      .slice(0, 30)
      .replace(/[%_\\]/g, "");
    let query = createAdminClient()
      .from("tags")
      .select("id,name")
      .order("name")
      .limit(100);
    if (q) query = query.ilike("name", `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return privateJson({ tags: data });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
