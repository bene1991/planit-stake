-- Cache for odds data to ensure deterministic analysis within the same day
CREATE TABLE IF NOT EXISTS public.lay0x1_odds_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date text NOT NULL,
  fixture_id integer NOT NULL,
  home_odd numeric(10,2) NOT NULL DEFAULT 0,
  draw_odd numeric(10,2) NOT NULL DEFAULT 0,
  away_odd numeric(10,2) NOT NULL DEFAULT 0,
  cached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, fixture_id)
);

ALTER TABLE public.lay0x1_odds_cache ENABLE ROW LEVEL SECURITY;

-- Service role and authenticated users can read/write
CREATE POLICY "Anyone can read odds cache" ON public.lay0x1_odds_cache FOR SELECT USING (true);
CREATE POLICY "Service role can insert odds cache" ON public.lay0x1_odds_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update odds cache" ON public.lay0x1_odds_cache FOR UPDATE USING (true);
CREATE POLICY "Service role can delete odds cache" ON public.lay0x1_odds_cache FOR DELETE USING (true);

CREATE INDEX idx_lay0x1_odds_cache_date ON public.lay0x1_odds_cache(date);
CREATE INDEX idx_lay0x1_odds_cache_fixture ON public.lay0x1_odds_cache(fixture_id);

-- Also cache team statistics for the day to ensure consistency
CREATE TABLE IF NOT EXISTS public.lay0x1_stats_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date text NOT NULL,
  fixture_id integer NOT NULL,
  home_goals_avg numeric(10,4) NOT NULL DEFAULT 0,
  away_conceded_avg numeric(10,4) NOT NULL DEFAULT 0,
  over15_combined numeric(10,2) NOT NULL DEFAULT 0,
  league_goals_avg numeric(10,4) NOT NULL DEFAULT 0,
  h2h_0x1_count integer NOT NULL DEFAULT 0,
  cached_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (date, fixture_id)
);

ALTER TABLE public.lay0x1_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stats cache" ON public.lay0x1_stats_cache FOR SELECT USING (true);
CREATE POLICY "Service role can insert stats cache" ON public.lay0x1_stats_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update stats cache" ON public.lay0x1_stats_cache FOR UPDATE USING (true);
CREATE POLICY "Service role can delete stats cache" ON public.lay0x1_stats_cache FOR DELETE USING (true);

CREATE INDEX idx_lay0x1_stats_cache_date ON public.lay0x1_stats_cache(date);
CREATE INDEX idx_lay0x1_stats_cache_fixture ON public.lay0x1_stats_cache(fixture_id);
