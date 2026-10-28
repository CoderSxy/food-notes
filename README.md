# 美食地图 · food-notes

Next.js 15 App Router + TypeScript + Supabase Postgres + Vercel，美食记录与附近 AI 推荐。

## 本地启动

运行 `npm install`，复制 `.env.example` 为 `.env.local` 并填写 Supabase 项目 URL、密钥和至少 32 字符的随机 SESSION_SECRET，然后 `npm run dev`。运行 `npm test` 执行 Vitest 测试，`npm run build` 构建。

## 数据库与部署

在 Supabase SQL Editor 中依次执行 `supabase/migrations/001_initial.sql` 和 `supabase/seed.sql`。Vercel 导入本仓库，选择 Next.js 框架并配置 `.env.example` 中的环境变量。

手机号验证码为测试模式，从服务端 `[OTP_TEST]` 日志读取，未接入真实短信。AI 通过服务端 OpenAI 兼容接口调用，配置 AI_BASE_URL、AI_MODEL、AI_API_KEY。密钥只放本地环境或 Vercel，禁止提交。

设计与逐项实施计划保留于 `docs/superpowers/`。
