begin;

-- The foods table was renamed to entries in 002; its check kept its name.
alter table public.entries drop constraint foods_rating_check;
-- An unconstrained numeric preserves exact input so 1.25 fails the check
-- rather than being rounded to an allowed value before validation.
alter table public.entries alter column rating type numeric using rating::numeric;
alter table public.entries add constraint entries_rating_check
  check (rating between 1 and 5 and mod(rating, 0.5) = 0);

commit;
