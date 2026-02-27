-- Add unique constraint to lay0x1_analyses to support upsert operations
ALTER TABLE public.lay0x1_analyses
ADD CONSTRAINT lay0x1_analyses_owner_fixture_unique UNIQUE (owner_id, fixture_id);
