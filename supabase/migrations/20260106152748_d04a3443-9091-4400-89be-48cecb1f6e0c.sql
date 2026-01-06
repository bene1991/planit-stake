-- Create fixture_cache table for persistent statistics and momentum caching
CREATE TABLE public.fixture_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id integer UNIQUE NOT NULL,
  updated_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'NS',
  minute_now integer DEFAULT 0,
  events_raw jsonb DEFAULT '[]'::jsonb,
  stats_raw jsonb DEFAULT '{}'::jsonb,
  momentum_series jsonb DEFAULT '[]'::jsonb,
  normalized_stats jsonb DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_fixture_cache_fixture_id ON public.fixture_cache(fixture_id);
CREATE INDEX idx_fixture_cache_status ON public.fixture_cache(status);
CREATE INDEX idx_fixture_cache_updated_at ON public.fixture_cache(updated_at);

-- Enable RLS
ALTER TABLE public.fixture_cache ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can read cached data)
CREATE POLICY "Anyone can read fixture_cache" 
ON public.fixture_cache 
FOR SELECT 
USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated can insert fixture_cache" 
ON public.fixture_cache 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update
CREATE POLICY "Authenticated can update fixture_cache" 
ON public.fixture_cache 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE public.fixture_cache IS 'Cache for API-Football fixture statistics and momentum data';