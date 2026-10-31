import { requireUser } from "@/lib/auth/requestUser";
import { apiError, privateJson } from "@/lib/http";
import { isR2Configured } from "@/lib/r2";

export async function GET(req: Request) {
  try {
    await requireUser(req);
    return privateJson({ configured: isR2Configured() });
  } catch (error) {
    return apiError(error);
  }
}

export const dynamic = "force-dynamic";
