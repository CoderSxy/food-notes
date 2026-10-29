import { z } from 'zod';
export const phoneSchema=z.string().max(30).transform(s=>s.replace(/[\s()+-]/g,'')).pipe(z.string().regex(/^\d{8,15}$/, '请输入有效手机号'));
export const sendOtpBodySchema=z.object({phone:phoneSchema});
export const verifyOtpBodySchema=z.object({phone:phoneSchema,code:z.string().regex(/^\d{6}$/, '请输入六位验证码')});

export const usernameSchema = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{3,32}$/, '用户名格式不正确'));

export const loginBodySchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, '请输入密码').max(200),
});
