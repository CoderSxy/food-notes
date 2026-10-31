import { verifySessionToken } from "./session";
import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/http";

export async function requireUser(req: Request) {
  const authorization = req.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  const user = match ? await verifySessionToken(match[1]) : null;
  if (!user) throw new HttpError("请先登录", 401);
  const { data, error } = await createAdminClient()
    .from("users")
    .select("id")
    .eq("id", user.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError("请先登录", 401);
  return user;
}
