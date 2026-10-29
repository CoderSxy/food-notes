# Username + Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Owner preference:** Prefer Codex CLI `codex exec -m gpt-6.1-sol -c 'model_reasoning_effort="medium"'` in repo root. Never commit secrets.

**Goal:** Make username + password the default login; keep phone OTP as secondary; no public registration.

**Architecture:** Extend `public.users` with nullable unique `username` and nullable `password_hash`; make `phone` nullable. Add scrypt helpers, `POST /api/auth/login`, and a login UI with password primary / OTP secondary. Adjust JWT session so `phone` is optional (password-only accounts). Keep existing OTP APIs and JWT cookie shape otherwise.

**Tech Stack:** Next.js 15 App Router, Supabase (service role), Zod, jose, Node `crypto.scrypt`, Vitest, Chinese UI copy.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-29-username-password-auth-design.md`
- No public register / reset / change-password
- OTP-only users may omit username/password
- Password accounts may omit phone
- Username: 3–32 `[a-z0-9_]`, stored lowercased
- Password min 8 on create (seed); login only verifies hash
- Fail login with single message 「用户名或密码错误」
- Never return or log `password_hash` / plaintext password
- No secrets / `.env.local` in git
- `npm test` and `npm run build` must pass (lazy `getEnv`)
- Codex model when used: `gpt-6.1-sol` medium

## File Structure

```
supabase/migrations/003_username_password.sql
scripts/hash-password.mjs
supabase/seed_users.example.sql
lib/auth/password.ts
lib/auth/session.ts              (phone optional)
lib/auth/login.ts
lib/validations/auth.ts          (+ loginBodySchema)
app/api/auth/login/route.ts
app/api/auth/verify-otp/route.ts (session call)
app/api/auth/me/route.ts         (enrich user)
app/login/page.tsx
tests/auth/password.test.ts
tests/auth/session.test.ts
tests/auth/login.test.ts
tests/validations/auth.test.ts
README.md
```

---

### Task 1: Migration — nullable phone, username, password_hash

**Files:**
- Create: `supabase/migrations/003_username_password.sql`
- Modify: `README.md` (Supabase init steps — mention 003)
- Test: manual SQL review + `npm test` still green (no runtime DB)

**Interfaces:**
- Consumes: existing `public.users (id, phone not null unique, nickname, created_at)`
- Produces: `users.phone` nullable unique; `users.username` nullable unique; `users.password_hash` nullable

- [ ] **Step 1: Write migration**

```sql
-- supabase/migrations/003_username_password.sql
-- Make phone optional; add username + password_hash for prebuilt accounts.

alter table public.users
  alter column phone drop not null;

alter table public.users
  add column if not exists username text,
  add column if not exists password_hash text;

-- Empty string is not a username
alter table public.users
  drop constraint if exists users_username_format;
alter table public.users
  add constraint users_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,32}$');

create unique index if not exists users_username_unique
  on public.users (username)
  where username is not null;

-- phone unique already exists as constraint from 001; keep uniqueness for non-null phones
-- (Postgres UNIQUE allows multiple NULLs)

comment on column public.users.username is 'Lowercased login id; null for OTP-only users';
comment on column public.users.password_hash is 'scrypt hash; never expose via API';
```

- [ ] **Step 2: Update README Supabase init list**

After `002_entries_items.sql` / `seed_categories.sql`, add:

5. (or next number) Execute `003_username_password.sql` once.  
6. Optionally insert prebuilt users via `scripts/hash-password.mjs` + SQL (see seed example after Task 2).

Keep Chinese README tone.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_username_password.sql README.md
git commit -m "feat: allow username password columns on users"
```

---

### Task 2: Password hashing helpers + CLI script

**Files:**
- Create: `lib/auth/password.ts`
- Create: `scripts/hash-password.mjs`
- Create: `supabase/seed_users.example.sql`
- Test: `tests/auth/password.test.ts`

**Interfaces:**
- Consumes: Node `crypto.scrypt`, `randomBytes`, `timingSafeEqual`
- Produces:
  - `hashPassword(password: string): Promise<string>` → stored form `scrypt$N$r$p$saltB64$hashB64`
  - `verifyPassword(password: string, stored: string): Promise<boolean>`
  - `normalizeUsername(raw: string): string` → trim + lowercase

- [ ] **Step 1: Write failing tests**

```ts
// tests/auth/password.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, normalizeUsername } from '@/lib/auth/password';

describe('password', () => {
  it('hashes and verifies', async () => {
    const stored = await hashPassword('correct-horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('correct-horse', stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
  });

  it('normalizes username', () => {
    expect(normalizeUsername('  Nero_01 ')).toBe('nero_01');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

```bash
npm test -- tests/auth/password.test.ts
```

Expected: cannot find `@/lib/auth/password`

- [ ] **Step 3: Implement**

```ts
// lib/auth/password.ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, KEYLEN, { N, r, p })) as Buffer;
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N0 = Number(parts[1]);
  const r0 = Number(parts[2]);
  const p0 = Number(parts[3]);
  if (!Number.isFinite(N0) || !Number.isFinite(r0) || !Number.isFinite(p0)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'base64url');
    expected = Buffer.from(parts[5], 'base64url');
  } catch {
    return false;
  }
  const actual = (await scryptAsync(password, salt, expected.length, { N: N0, r: r0, p: p0 })) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
```

```js
// scripts/hash-password.mjs — run: node scripts/hash-password.mjs 'your-password'
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
const scryptAsync = promisify(scrypt);
const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node scripts/hash-password.mjs <password-min-8-chars>');
  process.exit(1);
}
const N = 16384, r = 8, p = 1, KEYLEN = 64;
const salt = randomBytes(16);
const hash = await scryptAsync(password, salt, KEYLEN, { N, r, p });
console.log(`scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`);
```

```sql
-- supabase/seed_users.example.sql
-- Replace HASH with output of: node scripts/hash-password.mjs 'changeme-please'
-- Do not commit real production passwords in plaintext.

insert into public.users (username, password_hash, nickname, phone)
values ('demo', 'HASH', '演示账号', null)
on conflict (username) do nothing;
-- If unique index is partial, use:
-- insert ... where not exists (select 1 from users where username = 'demo');
```

Note: `on conflict (username)` requires a unique constraint on `username` (not only partial unique index). Prefer in migration:

```sql
alter table public.users add constraint users_username_key unique (username);
```

instead of partial unique index (Postgres UNIQUE already allows multiple NULLs). Update Task 1 migration accordingly when implementing: use `unique (username)` constraint, drop the partial-index-only approach.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test -- tests/auth/password.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth/password.ts scripts/hash-password.mjs supabase/seed_users.example.sql tests/auth/password.test.ts supabase/migrations/003_username_password.sql
git commit -m "feat: add scrypt password helpers and hash script"
```

---

### Task 3: Session token — optional phone

**Files:**
- Modify: `lib/auth/session.ts`
- Modify: `tests/auth/session.test.ts`
- Modify: `app/api/auth/verify-otp/route.ts` (still passes phone string)

**Interfaces:**
- Consumes: jose `SignJWT` / `jwtVerify`
- Produces:
  - `createSessionToken(userId: string, phone?: string | null): Promise<string>`
  - `verifySessionToken(token: string): Promise<{ userId: string; phone: string | null } | null>`

- [ ] **Step 1: Update failing/extended tests**

```ts
// tests/auth/session.test.ts
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';

afterEach(() => vi.unstubAllEnvs());

describe('session', () => {
  it('roundtrips with phone', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const token = await createSessionToken('user-1', '13800138000');
    expect(await verifySessionToken(token)).toEqual({ userId: 'user-1', phone: '13800138000' });
  });

  it('roundtrips without phone', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const token = await createSessionToken('user-2', null);
    expect(await verifySessionToken(token)).toEqual({ userId: 'user-2', phone: null });
  });

  it('rejects forged token', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    expect(await verifySessionToken('forged')).toBeNull();
  });

  it('rejects another signing key', async () => {
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    const token = await createSessionToken('u', '13800138000');
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(32));
    expect(await verifySessionToken(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL on no-phone case**

```bash
npm test -- tests/auth/session.test.ts
```

- [ ] **Step 3: Implement session**

```ts
// lib/auth/session.ts
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'food_session';

function secretKey() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('会话密钥未配置');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(userId: string, phone?: string | null) {
  const jwt = new SignJWT(phone ? { phone } : {})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setIssuer('food-notes')
    .setAudience('food-notes')
    .setExpirationTime('30d');
  return jwt.sign(secretKey());
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ['HS256'],
      issuer: 'food-notes',
      audience: 'food-notes',
    });
    if (!payload.sub) return null;
    const phone = typeof payload.phone === 'string' ? payload.phone : null;
    return { userId: payload.sub, phone };
  } catch {
    return null;
  }
}
```

Keep `verify-otp` calling `createSessionToken(userId, phone)` unchanged.

- [ ] **Step 4: Run tests PASS**

```bash
npm test -- tests/auth/session.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts tests/auth/session.test.ts
git commit -m "feat: allow session tokens without phone"
```

---

### Task 4: Login validation + service + API

**Files:**
- Modify: `lib/validations/auth.ts`
- Create: `lib/auth/login.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `tests/validations/auth-login.test.ts` (or extend existing)
- Create: `tests/auth/login.test.ts`

**Interfaces:**
- Consumes: `normalizeUsername`, `verifyPassword`, `createAdminClient`, `createSessionToken`
- Produces:
  - `loginBodySchema` → `{ username: string; password: string }`
  - `loginWithPassword(username: string, password: string): Promise<{ userId: string; username: string; phone: string | null }>`
  - `POST /api/auth/login` sets `SESSION_COOKIE`

- [ ] **Step 1: Validation tests + schemas**

```ts
// tests/validations/auth-login.test.ts
import { describe, it, expect } from 'vitest';
import { loginBodySchema } from '@/lib/validations/auth';

describe('loginBodySchema', () => {
  it('accepts and lowercases username', () => {
    expect(loginBodySchema.parse({ username: 'Nero_01', password: 'password1' })).toEqual({
      username: 'nero_01',
      password: 'password1',
    });
  });
  it('rejects short username or password', () => {
    expect(loginBodySchema.safeParse({ username: 'ab', password: 'password1' }).success).toBe(false);
    expect(loginBodySchema.safeParse({ username: 'abc', password: 'short' }).success).toBe(false);
  });
});
```

```ts
// append to lib/validations/auth.ts
export const usernameSchema = z
  .string()
  .trim()
  .transform((s) => s.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9_]{3,32}$/, '用户名格式不正确'));

export const loginBodySchema = z.object({
  username: usernameSchema,
  password: z.string().min(8, '请输入密码').max(200),
});
```

Note: login min password 8 rejects short attempts early; unknown-user still returns same Chinese error from service after schema passes. Spec: login only checks hash — schema min 8 is OK for UX consistency with create rule.

Alternative if you want schema to allow any non-empty password on login: use `z.string().min(1).max(200)` for login password and keep min 8 only in seed script. Prefer **`z.string().min(1).max(200)`** for login so wrong short passwords also become 「用户名或密码错误」 after a dummy verify path — implement as:

```ts
password: z.string().min(1, '请输入密码').max(200),
```

and adjust the validation test accordingly.

- [ ] **Step 2: Login service tests (mock supabase)**

```ts
// tests/auth/login.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPassword } from '@/lib/auth/password';

const from = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from }),
}));

import { loginWithPassword } from '@/lib/auth/login';

describe('loginWithPassword', () => {
  beforeEach(() => {
    from.mockReset();
  });

  it('returns user on correct password', async () => {
    const password_hash = await hashPassword('password1');
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 'u1', username: 'demo', password_hash, phone: null },
            error: null,
          }),
        }),
      }),
    });
    await expect(loginWithPassword('Demo', 'password1')).resolves.toEqual({
      userId: 'u1',
      username: 'demo',
      phone: null,
    });
  });

  it('throws same error for missing user or bad password', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
        }),
      }),
    });
    await expect(loginWithPassword('nope', 'password1')).rejects.toThrow('用户名或密码错误');
  });
});
```

- [ ] **Step 3: Implement login service + route**

```ts
// lib/auth/login.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeUsername, verifyPassword } from '@/lib/auth/password';

const FAIL = '用户名或密码错误';

export async function loginWithPassword(usernameRaw: string, password: string) {
  const username = normalizeUsername(usernameRaw);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, username, password_hash, phone')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  if (!data?.password_hash || !data.username) throw new Error(FAIL);
  const ok = await verifyPassword(password, data.password_hash as string);
  if (!ok) throw new Error(FAIL);
  return {
    userId: data.id as string,
    username: data.username as string,
    phone: (data.phone as string | null) ?? null,
  };
}
```

```ts
// app/api/auth/login/route.ts
import { cookies } from 'next/headers';
import { loginBodySchema } from '@/lib/validations/auth';
import { loginWithPassword } from '@/lib/auth/login';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';
import { apiError } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const { username, password } = loginBodySchema.parse(await req.json());
    const user = await loginWithPassword(username, password);
    const token = await createSessionToken(user.userId, user.phone);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 2592000,
    });
    return Response.json({
      ok: true,
      user: { userId: user.userId, username: user.username, phone: user.phone },
    });
  } catch (e) {
    return apiError(e);
  }
}
```

Ensure `apiError` maps generic `Error` messages to 400/401 appropriately (follow existing OTP pattern). If OTP uses 400 for bad code, use same for login FAIL.

- [ ] **Step 4: Run tests**

```bash
npm test -- tests/validations/auth-login.test.ts tests/auth/login.test.ts tests/auth/password.test.ts tests/auth/session.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/validations/auth.ts lib/auth/login.ts app/api/auth/login/route.ts tests/validations/auth-login.test.ts tests/auth/login.test.ts
git commit -m "feat: add username password login api"
```

---

### Task 5: Enrich `/api/auth/me` (optional fields, no hash)

**Files:**
- Modify: `lib/auth/requestUser.ts` and/or `app/api/auth/me/route.ts`
- Test: `tests/api/auth-me.test.ts` if pattern exists; else light unit around loader

**Interfaces:**
- Consumes: session `{ userId, phone }`, admin client
- Produces: `{ user: { userId, phone, username, nickname, hasPhone } }` without `password_hash`

- [ ] **Step 1: Implement me enrichment**

```ts
// app/api/auth/me/route.ts
import { getUserFromCookies } from '@/lib/auth/requestUser';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const session = await getUserFromCookies();
  if (!session) return Response.json({ error: '请先登录' }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('users')
    .select('id, username, nickname, phone')
    .eq('id', session.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return Response.json({ error: '请先登录' }, { status: 401 });
  return Response.json({
    user: {
      userId: data.id,
      username: data.username ?? null,
      nickname: data.nickname ?? null,
      phone: data.phone ?? null,
      hasPhone: Boolean(data.phone),
    },
  });
}
```

If throwing from route is inconsistent, wrap with `apiError` try/catch like other routes.

- [ ] **Step 2: Smoke test / unit as project patterns allow; run full `npm test`**

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/me/route.ts
git commit -m "feat: return username on auth me"
```

---

### Task 6: Login UI — password primary, OTP secondary

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: `POST /api/auth/login`, existing OTP endpoints, `requestJson` / `jsonBody`

- [ ] **Step 1: Rewrite login page**

Default mode `'password' | 'otp'`, default `'password'`.

Chinese copy:
- Title: 登录美食地图
- Tabs/links: 「账号密码」 / 「手机验证码」
- Password form: 用户名、密码、登录
- OTP form: keep existing send/verify UX and test-mode hint
- Signed-in state unchanged (退出登录)

Sketch:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestJson, jsonBody } from '@/lib/browser';

type Mode = 'password' | 'otp';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => {
        if (r.ok) setSignedIn(true);
      })
      .catch(() => {});
  }, []);

  async function loginPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await requestJson('/api/auth/login', jsonBody({ username, password }));
      router.push('/');
      router.refresh();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function otpAction(send: boolean) {
    setBusy(true);
    setMessage('');
    try {
      await requestJson(`/api/auth/${send ? 'send-otp' : 'verify-otp'}`, jsonBody({ phone, code }));
      if (send) setMessage('验证码已发送，请查看服务端日志');
      else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel narrow">
      <h1>登录美食地图</h1>
      {signedIn ? (
        <>
          <p>你已登录，可以继续记录美食。</p>
          <button
            onClick={async () => {
              await requestJson('/api/auth/logout', jsonBody({}));
              setSignedIn(false);
              setMessage('已退出登录');
            }}
          >
            退出登录
          </button>
        </>
      ) : (
        <>
          <p className="muted">
            <button type="button" onClick={() => setMode('password')} disabled={mode === 'password'}>
              账号密码
            </button>
            {' · '}
            <button type="button" onClick={() => setMode('otp')} disabled={mode === 'otp'}>
              手机验证码
            </button>
          </p>
          {mode === 'password' ? (
            <form onSubmit={loginPassword}>
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <label htmlFor="password">密码</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p>
                <button disabled={busy}>登录</button>
              </p>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void otpAction(false);
              }}
            >
              <p className="muted">测试模式：验证码见服务端日志。验证码十分钟内有效。</p>
              <label htmlFor="phone">手机号</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p>
                <button type="button" disabled={busy || !phone} onClick={() => void otpAction(true)}>
                  发送验证码
                </button>
              </p>
              <label htmlFor="code">验证码</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <p>
                <button disabled={busy}>登录</button>
              </p>
            </form>
          )}
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
```

- [ ] **Step 2: `npm test` && `npm run build`**

Expected: all tests pass; build succeeds (warnings OK if pre-existing unused vars).

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: password-first login ui with otp secondary"
```

---

### Task 7: Docs + mark design approved + push

**Files:**
- Modify: `README.md` (login section, seed users, env unchanged)
- Modify: `docs/superpowers/specs/2026-10-29-username-password-auth-design.md` status → Approved
- Push `origin/main`

- [ ] **Step 1: README**

Document:
- Default login is username/password; OTP secondary
- No self-registration; use `node scripts/hash-password.mjs` + SQL insert
- Run migration `003_username_password.sql`
- Link `supabase/seed_users.example.sql`

- [ ] **Step 2: Full verify**

```bash
npm test
npm run build
```

- [ ] **Step 3: Commit + push**

```bash
git add README.md docs/superpowers/specs/2026-10-29-username-password-auth-design.md
git commit -m "docs: username password login and seed instructions"
git push origin main
git log --oneline -12
```

---

## Spec coverage checklist

| Spec item | Task |
| --- | --- |
| phone nullable + username + password_hash | 1 |
| scrypt + seed hash script | 2 |
| session without phone | 3 |
| POST /api/auth/login + unified error | 4 |
| OTP APIs unchanged | 4 (no edits except session signature compat) |
| /api/auth/me without hash | 5 |
| UI password primary / OTP secondary | 6 |
| No public register | global / no task adds it |
| README + no secrets | 7 |

## Placeholder / consistency notes

- Use **unique constraint** on `username` (NULLs allowed), not partial unique only — so example SQL `ON CONFLICT` works.
- Login password Zod: `min(1)` so failed short passwords can still map through service error path if desired; seed script enforces min 8.
- `createSessionToken` second arg optional everywhere (login + OTP).
