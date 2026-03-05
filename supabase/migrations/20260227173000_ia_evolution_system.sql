-- IA Selection Evolution System
-- Dynamic thresholds that learn from historical data

-- 1. Table for dynamic IA thresholds (versioned with cycle tracking)
CREATE TABLE IF NOT EXISTS public.lay0x1_ia_thresholds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  cycle integer NOT NULL DEFAULT 1,

  -- Selection thresholds (these evolve)
  max_away_odd numeric NOT NULL DEFAULT 5.0,
  min_home_goals_avg numeric NOT NULL DEFAULT 1.2,
  min_away_conceded_avg numeric NOT NULL DEFAULT 1.5,
  min_btts_pct numeric NOT NULL DEFAULT 50,
  min_over25_pct numeric NOT NULL DEFAULT 60,
  max_home_clean_sheet_pct numeric NOT NULL DEFAULT 50,
  max_away_clean_sheet_pct numeric NOT NULL DEFAULT 40,

  -- Safety bounds (never go beyond these)
  bound_max_away_odd numeric NOT NULL DEFAULT 6.5,
  bound_min_away_odd numeric NOT NULL DEFAULT 3.0,
  bound_min_home_goals numeric NOT NULL DEFAULT 0.8,
  bound_max_home_goals numeric NOT NULL DEFAULT 2.5,
  bound_min_btts numeric NOT NULL DEFAULT 35,
  bound_max_btts numeric NOT NULL DEFAULT 75,
  bound_min_cs numeric NOT NULL DEFAULT 20,
  bound_max_cs numeric NOT NULL DEFAULT 65,

  -- Metadata
  games_since_calibration integer NOT NULL DEFAULT 0,
  calibration_trigger integer NOT NULL DEFAULT 20,
  last_calibrated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(owner_id)
);

-- 2. Evolution log — records every calibration adjustment
CREATE TABLE IF NOT EXISTS public.lay0x1_ia_evolution_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  cycle integer NOT NULL,
  
  -- Snapshot before and after
  thresholds_before jsonb NOT NULL,
  thresholds_after jsonb NOT NULL,
  
  -- Analysis that led to calibration
  total_games_analyzed integer NOT NULL DEFAULT 0,
  ia_games integer NOT NULL DEFAULT 0,
  ia_win_rate numeric,
  standard_win_rate numeric,
  adjustment_reason text,
  
  created_at timestamptz DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_ia_thresholds_owner ON public.lay0x1_ia_thresholds(owner_id);
CREATE INDEX IF NOT EXISTS idx_ia_evolution_owner ON public.lay0x1_ia_evolution_log(owner_id);

-- 4. RLS policies
ALTER TABLE public.lay0x1_ia_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lay0x1_ia_evolution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own IA thresholds" ON public.lay0x1_ia_thresholds
  FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Users read own IA evolution logs" ON public.lay0x1_ia_evolution_log
  FOR ALL USING (auth.uid() = owner_id);
