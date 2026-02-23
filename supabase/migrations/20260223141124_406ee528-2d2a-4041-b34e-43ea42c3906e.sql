
-- Table: lay0x1_analyses
CREATE TABLE public.lay0x1_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  fixture_id text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  league text NOT NULL,
  date text NOT NULL,
  score_value numeric NOT NULL DEFAULT 0,
  classification text NOT NULL DEFAULT 'Não recomendado',
  criteria_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  weights_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_score_home integer,
  final_score_away integer,
  was_0x1 boolean,
  result text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lay0x1_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lay0x1 analyses" ON public.lay0x1_analyses FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert their own lay0x1 analyses" ON public.lay0x1_analyses FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own lay0x1 analyses" ON public.lay0x1_analyses FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own lay0x1 analyses" ON public.lay0x1_analyses FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX idx_lay0x1_analyses_owner ON public.lay0x1_analyses(owner_id);
CREATE INDEX idx_lay0x1_analyses_date ON public.lay0x1_analyses(date);
CREATE INDEX idx_lay0x1_analyses_result ON public.lay0x1_analyses(result);

-- Table: lay0x1_weights
CREATE TABLE public.lay0x1_weights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL UNIQUE,
  offensive_weight numeric NOT NULL DEFAULT 20,
  defensive_weight numeric NOT NULL DEFAULT 20,
  over_weight numeric NOT NULL DEFAULT 20,
  league_avg_weight numeric NOT NULL DEFAULT 15,
  h2h_weight numeric NOT NULL DEFAULT 15,
  odds_weight numeric NOT NULL DEFAULT 10,
  min_home_goals_avg numeric NOT NULL DEFAULT 1.5,
  min_away_conceded_avg numeric NOT NULL DEFAULT 1.5,
  max_away_odd numeric NOT NULL DEFAULT 4.5,
  min_over15_combined numeric NOT NULL DEFAULT 70,
  max_h2h_0x1 integer NOT NULL DEFAULT 0,
  cycle_count integer NOT NULL DEFAULT 0,
  last_calibration_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lay0x1_weights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lay0x1 weights" ON public.lay0x1_weights FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert their own lay0x1 weights" ON public.lay0x1_weights FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own lay0x1 weights" ON public.lay0x1_weights FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own lay0x1 weights" ON public.lay0x1_weights FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX idx_lay0x1_weights_owner ON public.lay0x1_weights(owner_id);
