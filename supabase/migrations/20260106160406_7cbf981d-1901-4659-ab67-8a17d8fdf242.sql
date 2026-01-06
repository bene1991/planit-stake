-- Add key_events column to fixture_cache table
ALTER TABLE public.fixture_cache 
ADD COLUMN IF NOT EXISTS key_events JSONB DEFAULT '[]';