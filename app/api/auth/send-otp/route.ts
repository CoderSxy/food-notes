import { privateJson } from "@/lib/http";
import { sendOtpBodySchema } from "@/lib/validations/auth";
import { createAndStoreOtp } from "@/lib/auth/otp";
import { apiError } from "@/lib/http";
export async function POST(req: Request) {
  try {
    const { phone } = sendOtpBodySchema.parse(await req.json());
    await createAndStoreOtp(phone);
    return privateJson({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}

export const dynamic = "force-dynamic";
