-- Replace HASH with output of: node scripts/hash-password.mjs 'changeme-please'
-- Do not commit real production passwords in plaintext.

insert into public.users (username, password_hash, nickname, phone)
values ('demo', 'HASH', '演示账号', null)
on conflict (username) do nothing;
