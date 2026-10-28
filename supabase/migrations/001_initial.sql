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
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
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
