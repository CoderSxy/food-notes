import { privateJson } from "@/lib/http";
import { cookies } from "next/headers";
import { verifyOtpBodySchema } from "@/lib/validations/auth";
import { verifyOtp } from "@/lib/auth/otp";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const { phone, code } = verifyOtpBodySchema.parse(await req.json());
    const { userId } = await verifyOtp(phone, code);
    const token = await createSessionToken(userId, phone);
    (await cookies()).delete(SESSION_COOKIE);
    return privateJson({
      ok: true,
      accessToken: token,
      expiresAt: new Date(Date.now() + 2592000000).toISOString(),
      user: { userId, phone },
    });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
