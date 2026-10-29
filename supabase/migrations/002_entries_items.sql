begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete cascade,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  unique (parent_id, name)
);
create index categories_parent_idx on public.categories (parent_id);

-- A child must point to a root; roots with children cannot become children.
create function public.check_category_depth() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id or not exists (
      select 1 from public.categories where id = new.parent_id and parent_id is null
    ) or exists (
      select 1 from public.categories where parent_id = new.id
    ) then
      raise exception '分类仅支持大类和小类两级';
    end if;
  end if;
  return new;
end;
$$;
create trigger categories_depth before insert or update on public.categories
for each row execute function public.check_category_depth();

alter table public.foods rename to entries;
alter table public.entries add column kind text not null default 'place'
  check (kind in ('place', 'item'));
alter table public.food_cuisines rename to entry_cuisines;
alter table public.entry_cuisines rename column food_id to entry_id;
alter table public.food_tags rename to entry_tags;
alter table public.entry_tags rename column food_id to entry_id;
alter table public.entries alter column lat drop not null;
alter table public.entries alter column lng drop not null;
alter table public.entries add constraint entries_lat_range
  check (lat is null or lat between -90 and 90);
alter table public.entries add constraint entries_lng_range
  check (lng is null or lng between -180 and 180);
alter table public.entries add constraint entries_place_requires_coords
  check (kind <> 'place' or (lat is not null and lng is not null));

create table public.entry_categories (
  entry_id uuid not null references public.entries(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (entry_id, category_id)
);
alter table public.categories enable row level security;
alter table public.entry_categories enable row level security;
-- Renamed tables retain their existing RLS and foreign keys.
commit;
