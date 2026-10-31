import { privateJson } from "@/lib/http";
import { cookies } from "next/headers";
import { loginBodySchema } from "@/lib/validations/auth";
import { loginWithPassword } from "@/lib/auth/login";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { apiError } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const { username, password } = loginBodySchema.parse(await req.json());
    const user = await loginWithPassword(username, password);
    const token = await createSessionToken(user.userId, user.phone);
    (await cookies()).delete(SESSION_COOKIE);
    return privateJson({
      ok: true,
      accessToken: token,
      expiresAt: new Date(Date.now() + 2592000000).toISOString(),
      user: { userId: user.userId, username: user.username, phone: user.phone },
    });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
