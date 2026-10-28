import { z } from 'zod';
const schema = z.object({
 NEXT_PUBLIC_SUPABASE_URL: z.url(), NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
 SUPABASE_SERVICE_ROLE_KEY: z.string().min(1), SESSION_SECRET: z.string().min(32),
 AI_BASE_URL: z.url().default('https://api.nerosun.cn/v1'), AI_API_KEY: z.string().optional().default(''),
 AI_MODEL: z.string().min(1).default('deepseek-v4.1-flash'), OTP_TEST_MODE: z.enum(['true','false']).default('true'),
});
export type AppEnv = z.infer<typeof schema>;
export function getEnv(): AppEnv {
 const parsed = schema.safeParse(process.env);
 if (!parsed.success) throw new Error('服务配置不完整，请联系管理员');
 return parsed.data;
}
