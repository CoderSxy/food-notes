import { z } from 'zod';
export const phoneSchema=z.string().max(30).transform(s=>s.replace(/[\s()+-]/g,'')).pipe(z.string().regex(/^\d{8,15}$/, '请输入有效手机号'));
export const sendOtpBodySchema=z.object({phone:phoneSchema});
export const verifyOtpBodySchema=z.object({phone:phoneSchema,code:z.string().regex(/^\d{6}$/, '请输入六位验证码')});
