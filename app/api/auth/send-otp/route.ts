import { sendOtpBodySchema } from '@/lib/validations/auth';
import { createAndStoreOtp } from '@/lib/auth/otp';
import { apiError } from '@/lib/http';
export async function POST(req:Request) {
 try {const {phone}=sendOtpBodySchema.parse(await req.json());await createAndStoreOtp(phone);return Response.json({ok:true});}catch(e){return apiError(e);}
}
