import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/http";
export async function GET(req: Request) {
  try {
    await requireUser(req);
    const { data, error } = await createAdminClient()
      .from("cuisines")
      .select("id,name")
      .order("name");
    if (error) throw error;
    return privateJson({ cuisines: data });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
