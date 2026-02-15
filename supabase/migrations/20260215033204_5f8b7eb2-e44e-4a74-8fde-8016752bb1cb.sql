
-- Create api_cache table for persistent caching of API-Football responses
CREATE TABLE public.api_cache (
  cache_key text PRIMARY KEY,
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Index for fast lookup of non-expired entries
CREATE INDEX idx_api_cache_expires ON public.api_cache (expires_at);

-- Enable RLS
ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to read cache (shared cache)
CREATE POLICY "Authenticated can read api_cache"
ON public.api_cache FOR SELECT
USING (auth.role() = 'authenticated'::text);

-- Allow service_role full access (edge functions use service role for upsert)
CREATE POLICY "Service role full access api_cache"
ON public.api_cache FOR ALL
USING (auth.role() = 'service_role'::text);

-- Allow authenticated users to insert/update cache entries
CREATE POLICY "Authenticated can upsert api_cache"
ON public.api_cache FOR INSERT
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated can update api_cache"
ON public.api_cache FOR UPDATE
USING (auth.role() = 'authenticated'::text);
