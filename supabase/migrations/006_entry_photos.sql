-- supabase/migrations/006_entry_photos.sql
create table if not exists public.entry_photos (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  r2_key text not null,
  public_url text not null,
  sort int not null check (sort >= 0 and sort <= 2),
  width int,
  height int,
  bytes int,
  content_type text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, sort),
  unique (r2_key)
);

create index if not exists entry_photos_entry_id_sort_idx
  on public.entry_photos (entry_id, sort);

comment on table public.entry_photos is 'Optional entry photos stored in Cloudflare R2; max 3 per entry enforced in app.';
