import { cookies } from 'next/headers';
import { verifyOtpBodySchema } from '@/lib/validations/auth';
import { verifyOtp } from '@/lib/auth/otp';
import { createSessionToken,SESSION_COOKIE } from '@/lib/auth/session';
import { apiError } from '@/lib/http';
export async function POST(req:Request) {
 try {
 const {phone,code}=verifyOtpBodySchema.parse(await req.json()); const {userId}=await verifyOtp(phone,code);
 const token=await createSessionToken(userId,phone);
 (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:2592000});
 return Response.json({ok:true,user:{userId,phone}});
 }catch(e){return apiError(e);}
}
