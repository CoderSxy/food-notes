# Username + Password Auth (primary), OTP secondary

**Date:** 2026-10-29  
**Status:** Approved  
**Repo:** food-notes  
**Approach:** A — extend existing `users` + JWT session (not Supabase Auth)

## Goal

Make **username + password** the default login path. Keep **phone OTP** as a secondary option. Do **not** open public self-registration; password accounts are pre-created via SQL/seed.

## Decisions (approved)

- Phone optional on password accounts; OTP login remains available.
- Separate unique `username` for login; `nickname` stays display-only.
- No public register UI/API; seed or admin SQL only.
- OTP-only users need not set a password; prebuilt accounts use username + password.

## Data model

Migrate `public.users`:

| Column | Change |
| --- | --- |
| `phone` | Become **nullable**, still `UNIQUE` when present |
| `username` | **New**, nullable, `UNIQUE`, stored lowercased |
| `password_hash` | **New**, nullable text (scrypt or equivalent); never returned by API |
| `nickname` | Unchanged (display) |

**Login capability rule (app + DB check where practical):** a row is usable if it has either (`username` AND `password_hash`) **or** a non-null `phone`. OTP first login may still create phone-only users without password.

Existing OTP users keep working with `username`/`password_hash` null.

## Auth APIs

| Endpoint | Behavior |
| --- | --- |
| `POST /api/auth/login` | **New.** Body: `{ username, password }`. Normalize username to lowercase. Verify hash. Same 30-day httpOnly JWT cookie as OTP. Failures return a single message: 「用户名或密码错误」 (no user-enumeration). |
| `POST /api/auth/send-otp` | Unchanged (test mode). |
| `POST /api/auth/verify-otp` | Unchanged; may create phone-only user. |
| `POST /api/auth/logout` | Unchanged. |
| `GET /api/auth/me` | May include `username` and whether phone is bound; **never** `password_hash`. |

No public register / password-reset / change-password endpoints in this scope.

## Password hashing

- Hash with Node `crypto.scrypt` (or documented equivalent), random salt, parameters recorded in code.
- Plain passwords never logged or stored.
- Seed docs include a small local script to generate `password_hash` for SQL inserts. Example seed users may ship; real production passwords must not be committed in plaintext.

## Login UI

- Default tab/form: username + password → `POST /api/auth/login`.
- Secondary switch: existing phone + OTP flow.
- Chinese copy throughout.

## Username / password rules

- Username: 3–32 chars, `[a-z0-9_]`, lowercased before store/compare.
- Password: minimum 8 characters on create (seed/admin); login only checks hash match.

## Testing

- Login success and wrong password / unknown user (same error).
- Migration: `phone` nullable; unique username.
- OTP path still creates/logs in phone-only users.
- `/api/auth/me` shape without secrets.
- `npm test` and `npm run build` pass (lazy `getEnv`).

## Out of scope

- Public self-registration
- Password reset / change-password UI
- OAuth / Supabase Auth migration
- Extra rate-limit / captcha beyond current OTP limits
- Forcing OTP users to set username/password

## Implementation note

Prefer Codex CLI (`gpt-6.1-sol`, medium) after the implementation plan is approved; no secrets in git.
