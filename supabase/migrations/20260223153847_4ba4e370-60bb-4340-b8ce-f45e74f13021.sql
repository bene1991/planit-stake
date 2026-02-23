
-- 1. Remove duplicates (keep oldest)
DELETE FROM lay0x1_analyses a
USING lay0x1_analyses b
WHERE a.owner_id = b.owner_id
  AND a.fixture_id = b.fixture_id
  AND a.created_at > b.created_at;

-- 2. Add unique constraint
ALTER TABLE lay0x1_analyses
  ADD CONSTRAINT unique_owner_fixture UNIQUE (owner_id, fixture_id);

-- 3. Create blocked leagues table
CREATE TABLE public.lay0x1_blocked_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  league_name text NOT NULL,
  reason text NOT NULL DEFAULT 'nao_disponivel',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, league_name)
);

ALTER TABLE public.lay0x1_blocked_leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own blocked leagues"
  ON public.lay0x1_blocked_leagues FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own blocked leagues"
  ON public.lay0x1_blocked_leagues FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own blocked leagues"
  ON public.lay0x1_blocked_leagues FOR DELETE
  USING (auth.uid() = owner_id);
