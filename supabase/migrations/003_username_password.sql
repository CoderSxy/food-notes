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

alter table public.users
  drop constraint if exists users_username_key;
alter table public.users
  add constraint users_username_key unique (username);

comment on column public.users.username is 'Lowercased login id; null for OTP-only users';
comment on column public.users.password_hash is 'scrypt hash; never expose via API';
