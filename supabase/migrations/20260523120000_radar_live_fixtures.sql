CREATE TABLE IF NOT EXISTS public.radar_live_fixtures (
  fixture_id text PRIMARY KEY,
  home_team text,
  away_team text,
  league_id text,
  league_name text,
  home_score integer,
  away_score integer,
  minute integer,
  status text,
  stats_snapshot jsonb,
  matched_variations text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_live_updated ON public.radar_live_fixtures(updated_at DESC);

ALTER TABLE public.radar_live_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read radar_live_fixtures" ON public.radar_live_fixtures FOR SELECT USING (true);
CREATE POLICY "Cron manage radar_live_fixtures" ON public.radar_live_fixtures FOR ALL USING (true);
