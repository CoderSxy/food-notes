-- Optional performance indexes for scoped dashboards; safe to rerun.
CREATE INDEX IF NOT EXISTS entries_user_created_id_idx ON public.entries (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS entries_created_id_idx ON public.entries (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS entries_mapped_user_created_idx ON public.entries (user_id, created_at DESC, id DESC) WHERE lat IS NOT NULL AND lng IS NOT NULL;
