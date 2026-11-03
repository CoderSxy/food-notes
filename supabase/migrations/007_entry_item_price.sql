alter table public.entries
  add column price numeric(10,2);

alter table public.entries
  add constraint entries_price_nonnegative
  check (price is null or price >= 0);

alter table public.entries
  add constraint entries_price_item_only
  check (price is null or kind = 'item');
