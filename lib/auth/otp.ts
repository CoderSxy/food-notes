import { randomInt } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getEnv } from '@/lib/env';
export function normalizePhone(phone:string) { return phone.replace(/\D/g,''); }
export function generateOtpCode() { return String(randomInt(0,1000000)).padStart(6,'0'); }
export async function createAndStoreOtp(phone:string) {
 const env=getEnv();
 if(env.OTP_TEST_MODE==='false') throw new Error('短信通道尚未启用，请启用测试模式');
 const normalized=normalizePhone(phone),code=generateOtpCode(),expiresAt=new Date(Date.now()+600000);
 const admin=createAdminClient();
 const {data:recent,error:readError}=await admin.from('otp_codes').select('id').eq('phone',normalized).gte('created_at',new Date(Date.now()-60000).toISOString()).limit(1);
 if(readError) throw readError;
 if(recent?.length) throw new Error('请稍后再发送验证码');
 const {error}=await admin.from('otp_codes').insert({phone:normalized,code,expires_at:expiresAt.toISOString(),channel:'test'});
 if(error) throw error;
 console.info(`[OTP_TEST] phone=${normalized} code=${code}`);
 return {code,expiresAt};
}
export async function verifyOtp(phone:string,code:string) {
 const normalized=normalizePhone(phone),admin=createAdminClient();
 const {data:row,error}=await admin.from('otp_codes').select('id,code,expires_at').eq('phone',normalized).is('consumed_at',null).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error) throw error;
 if(!row || row.code!==code) throw new Error('验证码错误，请重新输入');
 if(new Date(row.expires_at).getTime()<=Date.now()) throw new Error('验证码已过期，请重新发送');
 const {data:consumed,error:consumeError}=await admin.from('otp_codes').update({consumed_at:new Date().toISOString()}).eq('id',row.id).is('consumed_at',null).gt('expires_at',new Date().toISOString()).select('id');
 if(consumeError) throw consumeError;
 if(!consumed?.length) throw new Error('验证码已使用或过期，请重新发送');
 const {data:existing,error:lookupError}=await admin.from('users').select('id').eq('phone',normalized).maybeSingle();
 if(lookupError) throw lookupError;
 if(existing) return {userId:existing.id as string};
 const {data:created,error:createError}=await admin.from('users').upsert({phone:normalized,nickname:`用户${normalized.slice(-4)}`},{onConflict:'phone'}).select('id').single();
 if(createError) throw createError;
 return {userId:created.id as string};
}
