# Food Platform (美食记录 + AI 推荐) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Implementation runtime (owner preference):** Prefer **Codex CLI** (`codex exec`) with model **`gpt-6.1` sol medium** (owner wording:「gpt6.1 sol medium」). If the exact model id differs in the local Codex build, resolve the closest matching model id that contains `gpt-6.1` / `6.1` and medium reasoning, then record the resolved id in the PR/README. Do **not** put `AI_API_KEY` or other secrets into git; use `.env.local` / Vercel env only.
>
> Suggested Codex invocation pattern (adjust model id after resolving):
> ```bash
> codex exec -m "<resolved-gpt-6.1-sol-medium>" -C /path/to/repo --skip-git-repo-check -s workspace-write "$(cat task-prompt.md)"
> ```

**Goal:** Build a multi-user public web app where people sign in with phone OTP (test mode), record food spots with geolocation, cuisine tags, freeform tags, and a 1–5 rating, then get AI recommendations near their current location.

**Architecture:** Next.js App Router on Vercel; Route Handlers own OTP, session cookies, foods CRUD, nearby query, and AI proxy. Supabase Postgres holds data with RLS. AI calls go server-side to an OpenAI-compatible base URL from env.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Supabase JS + Postgres, Zod, jose (session JWT in httpOnly cookie), Vitest + Testing Library, Tailwind CSS, deploy on Vercel.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-28-food-platform-design.md`
- Phone OTP channel for MVP: `test` only (log code server-side); reserve `channel` column for later SMS providers
- Rating: integer 1–5 inclusive
- Multiple cuisines and multiple freeform tags per food
- AI: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` env only; never commit secrets
- Unauthenticated users cannot create foods or call recommend; authenticated users can read list
- Nearby empty → honest “样本不足” + CTA to create; never invent shop names
- Public GitHub repo; include README + `.env.example`
- Prefer Codex CLI + gpt-6.1 sol medium for implementation work

## File Structure

```
/
  package.json
  tsconfig.json
  next.config.ts
  vitest.config.ts
  .env.example
  README.md
  docs/superpowers/specs/2026-10-28-food-platform-design.md
  docs/superpowers/plans/2026-10-28-food-platform.md
  supabase/migrations/001_initial.sql
  supabase/seed.sql
  lib/
    env.ts
    supabase/admin.ts
    supabase/server.ts
    auth/otp.ts
    auth/session.ts
    geo/haversine.ts
    ai/client.ts
    validations/auth.ts
    validations/food.ts
  app/
    layout.tsx
    globals.css
    page.tsx
    login/page.tsx
    foods/new/page.tsx
    foods/[id]/page.tsx
    recommend/page.tsx
    api/auth/send-otp/route.ts
    api/auth/verify-otp/route.ts
    api/auth/logout/route.ts
    api/auth/me/route.ts
    api/cuisines/route.ts
    api/tags/route.ts
    api/foods/route.ts
    api/foods/[id]/route.ts
    api/foods/nearby/route.ts
    api/recommend/route.ts
  components/
    FoodCard.tsx
    FoodForm.tsx
    StarRating.tsx
    TagPicker.tsx
    CuisinePicker.tsx
    LocationField.tsx
    RecommendResult.tsx
  tests/
    auth/otp.test.ts
    auth/session.test.ts
    geo/haversine.test.ts
    validations/food.test.ts
    ai/client.test.ts
```

---

### Task 1: Scaffold Next.js app + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `.env.example`, `README.md`
- Copy in: `docs/superpowers/specs/2026-10-28-food-platform-design.md`, `docs/superpowers/plans/2026-10-28-food-platform.md`

**Interfaces:**
- Produces: runnable `npm run dev`, `npm test`; env names documented in `.env.example`

- [ ] **Step 1: Create Next.js TypeScript App Router project**

```bash
npx create-next-app@15 . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --turbopack --yes
```

If the directory is not empty, scaffold into a temp folder and move files, or manually create the same layout. Ensure `app/page.tsx` renders a Chinese title 「美食地图」.

- [ ] **Step 2: Add dependencies**

```bash
npm install @supabase/supabase-js zod jose
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Write `.env.example` (no secrets)**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=replace-with-long-random-string
AI_BASE_URL=https://api.nerosun.cn/v1
AI_API_KEY=
AI_MODEL=deepseek-v4.1-flash
OTP_TEST_MODE=true
```

- [ ] **Step 5: Minimal README**

Document: stack, env vars, `npm i && npm run dev`, Supabase migration apply, Vercel deploy, OTP test mode (codes in server logs), Codex note for contributors optional.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js food platform with vitest and env example"
```

---

### Task 2: Supabase schema + seed

**Files:**
- Create: `supabase/migrations/001_initial.sql`, `supabase/seed.sql`

**Interfaces:**
- Produces: tables `users`, `otp_codes`, `cuisines`, `tags`, `foods`, `food_cuisines`, `food_tags` with RLS policies as below

- [ ] **Step 1: Write migration SQL**

`supabase/migrations/001_initial.sql`:

```sql
create extension if not exists "pgcrypto";

create table public.users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  nickname text,
  created_at timestamptz not null default now()
);

create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  channel text not null default 'test',
  created_at timestamptz not null default now()
);
create index otp_codes_phone_created_idx on public.otp_codes (phone, created_at desc);

create table public.cuisines (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  note text,
  rating int not null check (rating >= 1 and rating <= 5),
  lat double precision not null,
  lng double precision not null,
  address_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index foods_geo_idx on public.foods (lat, lng);
create index foods_created_idx on public.foods (created_at desc);

create table public.food_cuisines (
  food_id uuid not null references public.foods(id) on delete cascade,
  cuisine_id uuid not null references public.cuisines(id) on delete cascade,
  primary key (food_id, cuisine_id)
);

create table public.food_tags (
  food_id uuid not null references public.foods(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (food_id, tag_id)
);

alter table public.users enable row level security;
alter table public.otp_codes enable row level security;
alter table public.cuisines enable row level security;
alter table public.tags enable row level security;
alter table public.foods enable row level security;
alter table public.food_cuisines enable row level security;
alter table public.food_tags enable row level security;

-- App uses service role in Route Handlers for OTP/session; anon key may be unused in MVP.
-- Deny-by-default for anon; service role bypasses RLS.
```

- [ ] **Step 2: Seed cuisines**

`supabase/seed.sql`:

```sql
insert into public.cuisines (name, slug) values
  ('川菜', 'sichuan'),
  ('粤菜', 'cantonese'),
  ('湘菜', 'hunan'),
  ('江浙菜', 'jiangzhe'),
  ('日料', 'japanese'),
  ('韩料', 'korean'),
  ('西餐', 'western'),
  ('火锅', 'hotpot'),
  ('烧烤', 'bbq'),
  ('小吃', 'snacks')
on conflict (name) do nothing;
```

- [ ] **Step 3: Document apply steps in README**

Add: create Supabase project → SQL editor run `001_initial.sql` then `seed.sql` → copy URL and keys to `.env.local`.

- [ ] **Step 4: Commit**

```bash
git add supabase README.md
git commit -m "feat: add supabase schema, rls deny-default, cuisine seed"
```

---

### Task 3: Env + Supabase admin client + geo helper

**Files:**
- Create: `lib/env.ts`, `lib/supabase/admin.ts`, `lib/geo/haversine.ts`, `tests/geo/haversine.test.ts`

**Interfaces:**
- Produces: `getEnv()`, `createAdminClient()`, `haversineKm(a, b): number`

- [ ] **Step 1: Failing test for haversine**

```ts
// tests/geo/haversine.test.ts
import { describe, it, expect } from "vitest";
import { haversineKm } from "@/lib/geo/haversine";

describe("haversineKm", () => {
  it("returns ~0 for same point", () => {
    expect(haversineKm({ lat: 31.23, lng: 121.47 }, { lat: 31.23, lng: 121.47 })).toBeLessThan(0.001);
  });
  it("is about 1.1km for ~0.01 deg lat difference near equator-ish", () => {
    const d = haversineKm({ lat: 0, lng: 0 }, { lat: 0.01, lng: 0 });
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
npm test -- tests/geo/haversine.test.ts
```

Expected: FAIL module not found / function missing.

- [ ] **Step 3: Implement**

```ts
// lib/geo/haversine.ts
export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

```ts
// lib/env.ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  AI_BASE_URL: z.string().url(),
  AI_API_KEY: z.string().min(1),
  AI_MODEL: z.string().min(1),
  OTP_TEST_MODE: z.string().optional().default("true"),
});

export type AppEnv = z.infer<typeof schema>;

export function getEnv(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }
  return parsed.data;
}
```

```ts
// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- tests/geo/haversine.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib tests
git commit -m "feat: add env validation, supabase admin client, haversine"
```

---

### Task 4: OTP service (test mode) + session JWT

**Files:**
- Create: `lib/auth/otp.ts`, `lib/auth/session.ts`, `lib/validations/auth.ts`, `tests/auth/otp.test.ts`, `tests/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(phone: string): string`
  - `generateOtpCode(): string` (6 digits)
  - `createAndStoreOtp(phone: string): Promise<{ code: string; expiresAt: Date }>` — when `OTP_TEST_MODE`, `console.info` the code
  - `verifyOtp(phone: string, code: string): Promise<{ userId: string }>`
  - `createSessionToken(userId: string, phone: string): Promise<string>`
  - `verifySessionToken(token: string): Promise<{ userId: string; phone: string } | null>`
  - Cookie name: `food_session`

- [ ] **Step 1: Failing tests**

```ts
// tests/auth/otp.test.ts
import { describe, it, expect } from "vitest";
import { normalizePhone, generateOtpCode } from "@/lib/auth/otp";

describe("normalizePhone", () => {
  it("strips spaces and keeps digits", () => {
    expect(normalizePhone(" 138 0013 8000 ")).toBe("13800138000");
  });
});

describe("generateOtpCode", () => {
  it("returns 6 digits", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
});
```

```ts
// tests/auth/session.test.ts
import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("session jwt", () => {
  it("roundtrips", async () => {
    process.env.SESSION_SECRET = "x".repeat(32);
    const token = await createSessionToken("user-1", "13800138000");
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ userId: "user-1", phone: "13800138000" });
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- tests/auth
```

- [ ] **Step 3: Implement validations + OTP + session**

```ts
// lib/validations/auth.ts
import { z } from "zod";

export const phoneSchema = z.string().min(8).max(20);
export const sendOtpBodySchema = z.object({ phone: phoneSchema });
export const verifyOtpBodySchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/),
});
```

```ts
// lib/auth/otp.ts
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createAndStoreOtp(phone: string) {
  const normalized = normalizePhone(phone);
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const env = getEnv();
  const admin = createAdminClient();
  const { error } = await admin.from("otp_codes").insert({
    phone: normalized,
    code,
    expires_at: expiresAt.toISOString(),
    channel: "test",
  });
  if (error) throw error;
  if (env.OTP_TEST_MODE !== "false") {
    console.info(`[OTP_TEST] phone=${normalized} code=${code}`);
  }
  return { code, expiresAt };
}

export async function verifyOtp(phone: string, code: string) {
  const normalized = normalizePhone(phone);
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("otp_codes")
    .select("*")
    .eq("phone", normalized)
    .eq("code", code)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = rows?.[0];
  if (!row) throw new Error("INVALID_OTP");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("OTP_EXPIRED");
  await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);

  const { data: existing } = await admin.from("users").select("id").eq("phone", normalized).maybeSingle();
  if (existing) return { userId: existing.id as string };
  const { data: created, error: createErr } = await admin
    .from("users")
    .insert({ phone: normalized, nickname: `用户${normalized.slice(-4)}` })
    .select("id")
    .single();
  if (createErr) throw createErr;
  return { userId: created.id as string };
}
```

```ts
// lib/auth/session.ts
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "food_session";
export const SESSION_COOKIE = COOKIE;

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET missing");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(userId: string, phone: string) {
  return new SignJWT({ phone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub || typeof payload.phone !== "string") return null;
    return { userId: payload.sub, phone: payload.phone };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests — expect pass** (for pure functions; DB-backed functions may stay untested in unit suite or mocked later)

```bash
npm test -- tests/auth
```

- [ ] **Step 5: Commit**

```bash
git add lib tests
git commit -m "feat: add test-mode otp helpers and jwt session"
```

---

### Task 5: Auth API routes + login page

**Files:**
- Create: `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/me/route.ts`, `app/login/page.tsx`
- Optional helper: `lib/auth/requestUser.ts` reading cookie

**Interfaces:**
- `POST /api/auth/send-otp` `{ phone }` → `{ ok: true }` (never returns code in production response)
- `POST /api/auth/verify-otp` `{ phone, code }` → sets httpOnly cookie, `{ ok: true, user }`
- `POST /api/auth/logout` clears cookie
- `GET /api/auth/me` → user or 401

- [ ] **Step 1: Implement `getUserFromRequest(req)`**

```ts
// lib/auth/requestUser.ts
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export async function getUserFromCookies() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
```

- [ ] **Step 2: Implement routes**

`send-otp`: parse body with `sendOtpBodySchema`, call `createAndStoreOtp`, return `{ ok: true }`. On error 400/500 JSON `{ error }`.

`verify-otp`: parse, `verifyOtp`, `createSessionToken`, `cookies().set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60*60*24*30 })`.

`logout`: delete cookie.

`me`: return session or 401.

- [ ] **Step 3: Login UI (Chinese)**

Client page: phone input → 发送验证码 → code input → 登录. Show note: 「测试模式：验证码见服务端日志」. On success `router.push("/")`.

- [ ] **Step 4: Manual smoke**

With `.env.local` filled, `npm run dev`, send OTP, copy code from terminal, verify, confirm `/api/auth/me` works.

- [ ] **Step 5: Commit**

```bash
git add app lib
git commit -m "feat: phone otp auth apis and login page (test mode)"
```

---

### Task 6: Food validations + Foods / cuisines / tags APIs

**Files:**
- Create: `lib/validations/food.ts`, `tests/validations/food.test.ts`, `app/api/cuisines/route.ts`, `app/api/tags/route.ts`, `app/api/foods/route.ts`, `app/api/foods/[id]/route.ts`, `app/api/foods/nearby/route.ts`

**Interfaces:**
- `foodCreateSchema`: name, note?, rating 1-5, lat, lng, address_text?, cuisineIds: uuid[], tagNames: string[]
- `GET /api/cuisines` list
- `GET /api/tags?q=` optional search
- `GET /api/foods` latest (auth required)
- `POST /api/foods` create with joins (auth)
- `GET /api/foods/[id]`
- `DELETE /api/foods/[id]` owner only
- `GET /api/foods/nearby?lat=&lng=&radiusKm=5` auth, sort by haversine

- [ ] **Step 1: Failing validation tests**

```ts
// tests/validations/food.test.ts
import { describe, it, expect } from "vitest";
import { foodCreateSchema } from "@/lib/validations/food";

describe("foodCreateSchema", () => {
  it("accepts rating 1-5", () => {
    const r = foodCreateSchema.safeParse({
      name: "小笼包",
      rating: 5,
      lat: 31.2,
      lng: 121.5,
      cuisineIds: [],
      tagNames: ["夜宵"],
    });
    expect(r.success).toBe(true);
  });
  it("rejects rating 0", () => {
    const r = foodCreateSchema.safeParse({
      name: "x",
      rating: 0,
      lat: 0,
      lng: 0,
      cuisineIds: [],
      tagNames: [],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Implement schema + routes**

On `POST /api/foods`: upsert tags by normalized name; insert food; insert join rows. Return full food with cuisines/tags.

Nearby: fetch candidate foods (bounding box optional YAGNI — fetch recent N=500 and sort in memory with `haversineKm` for MVP), filter `distance <= radiusKm`, return with `distanceKm`.

- [ ] **Step 3: Run unit tests**

```bash
npm test -- tests/validations/food.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib app tests
git commit -m "feat: foods crud, nearby query, cuisines and tags apis"
```

---

### Task 7: UI — home, create form, detail

**Files:**
- Create/modify: `app/page.tsx`, `app/foods/new/page.tsx`, `app/foods/[id]/page.tsx`, `components/FoodCard.tsx`, `components/FoodForm.tsx`, `components/StarRating.tsx`, `components/TagPicker.tsx`, `components/CuisinePicker.tsx`, `components/LocationField.tsx`

**Interfaces:**
- LocationField: `navigator.geolocation.getCurrentPosition`, on deny show lat/lng number inputs
- StarRating: 1–5 clickable
- FoodForm posts to `POST /api/foods`

- [ ] **Step 1: Build components with Chinese copy**

- [ ] **Step 2: Wire pages**

Home: fetch foods, show cards, links 记一笔 / AI 推荐 / 登录. If 401, redirect login for write actions.

- [ ] **Step 3: Manual smoke** — create one food with multi cuisine, multi tags, rating 4, see on home and detail.

- [ ] **Step 4: Commit**

```bash
git add app components
git commit -m "feat: food list, create form with geo tags rating, detail page"
```

---

### Task 8: AI client + recommend API + page

**Files:**
- Create: `lib/ai/client.ts`, `tests/ai/client.test.ts`, `app/api/recommend/route.ts`, `app/recommend/page.tsx`, `components/RecommendResult.tsx`

**Interfaces:**
- `chatCompletion(messages): Promise<string>` → POST `${AI_BASE_URL}/chat/completions` with Bearer key, model from env
- `POST /api/recommend` body `{ lat, lng, radiusKm?: number }` auth required
  - load nearby foods
  - if empty → `{ recommendations: [], message: "附近暂无足够样本，先去登记几家美食吧" }`
  - else prompt model to pick from **provided list only**, return JSON array `{ foodId, reason }[]`
  - parse; drop unknown foodIds

- [ ] **Step 1: Unit test parser / prompt builder (mock fetch)**

```ts
// tests/ai/client.test.ts
import { describe, it, expect, vi } from "vitest";
import { chatCompletion } from "@/lib/ai/client";

describe("chatCompletion", () => {
  it("returns assistant content", async () => {
    process.env.AI_BASE_URL = "https://example.com/v1";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_MODEL = "deepseek-v4.1-flash";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "hello" } }] }),
      }),
    );
    await expect(chatCompletion([{ role: "user", content: "hi" }])).resolves.toBe("hello");
  });
});
```

Note: if `chatCompletion` reads via `getEnv()`, set all required env in the test.

- [ ] **Step 2: Implement client + route + UI**

System prompt must say: only recommend from the given candidates; if none suitable say so; respond with JSON only.

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/ai/client.test.ts
```

- [ ] **Step 4: Manual smoke** with real `AI_*` in `.env.local` (do not commit).

- [ ] **Step 5: Commit**

```bash
git add lib app components tests
git commit -m "feat: ai nearby recommend via openai-compatible api"
```

---

### Task 9: Polish README, .gitignore, deploy checklist

**Files:**
- Modify: `README.md`, `.gitignore`
- Ensure: `.env*`, secrets ignored; design+plan docs present in repo

- [ ] **Step 1: Confirm `.gitignore` includes `.env`, `.env.local`, `.vercel`**

- [ ] **Step 2: README sections** — Local, Supabase, Vercel env table, OTP test mode, AI env, security note (no keys in git)

- [ ] **Step 3: Full `npm test` + `npm run build`**

```bash
npm test
npm run build
```

Expected: tests pass; build succeeds (may need dummy env at build if `getEnv` runs at import — lazy-call `getEnv` only inside handlers to avoid build failure).

- [ ] **Step 4: Commit**

```bash
git add README.md .gitignore
git commit -m "docs: finalize readme and deploy checklist"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Next.js + Supabase + Vercel | 1, 2, 9 |
| Phone OTP test mode + later channel field | 2, 4, 5 |
| Multi-user public platform | 4–7 |
| Geolocation register | 6, 7 |
| Cuisines multi + tags multi + rating 1–5 | 2, 6, 7 |
| AI recommend with location + own API | 8 |
| Empty nearby honesty | 8 |
| Error handling (geo deny, OTP, AI) | 5, 7, 8 |
| Secrets in env only | 1, 9 |
| Public repo docs | 1, 9 |

Placeholder scan: none of the forbidden plan stubs remain. Session approach locked to httpOnly JWT (`food_session`) + service-role Supabase from Route Handlers.

---

## Execution notes for this project

1. Create / connect a **public GitHub** repository (Cursor cannot mint GitHub repos; owner creates empty public repo or authorizes Origin then publish). Copy design+plan into the repo first commit if scaffolding elsewhere.
2. Implement with **Codex CLI**, model **gpt-6.1 sol medium** (resolve exact `-m` id locally).
3. After plan approval of execution mode, run tasks in order; do not skip tests in Tasks 3–4, 6, 8.
