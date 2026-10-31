import { privateJson } from "@/lib/http";
import { requireUser } from "@/lib/auth/requestUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const session = await requireUser(req);
    if (!session) return privateJson({ error: "请先登录" }, { status: 401 });
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .select("id, username, nickname, phone")
      .eq("id", session.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return privateJson({ error: "请先登录" }, { status: 401 });
    return privateJson({
      user: {
        userId: data.id,
        username: data.username ?? null,
        nickname: data.nickname ?? null,
        phone: data.phone ?? null,
        hasPhone: Boolean(data.phone),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
