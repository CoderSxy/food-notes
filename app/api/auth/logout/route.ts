import { privateJson } from "@/lib/http";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth/session";
export async function POST() {
  (await cookies()).delete(SESSION_COOKIE);
  return privateJson({ ok: true });
}

export const dynamic = "force-dynamic";
