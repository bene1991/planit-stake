-- Create independent robot tables

-- 1. Independent Blocked Leagues
CREATE TABLE IF NOT EXISTS public.robot_blocked_leagues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  league_id text NOT NULL,
  league_name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(league_id)
);

ALTER TABLE public.robot_blocked_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read robot_blocked_leagues" ON public.robot_blocked_leagues FOR SELECT USING (true);
CREATE POLICY "Users can manage robot_blocked_leagues" ON public.robot_blocked_leagues FOR ALL USING (auth.uid() IS NOT NULL);

-- 2. Dynamic Variations
CREATE TABLE IF NOT EXISTS public.robot_variations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  first_half_only boolean DEFAULT true,
  min_minute integer DEFAULT 15,
  max_minute integer DEFAULT 30,
  require_score_zero boolean DEFAULT true,
  min_shots integer DEFAULT 0,
  min_shots_on_target integer DEFAULT 0,
  min_dangerous_attacks integer DEFAULT 0,
  min_possession integer DEFAULT 0,
  min_combined_shots integer DEFAULT 0,
  min_over15_pre integer DEFAULT 0,
  min_lambda_total numeric DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.robot_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read robot_variations" ON public.robot_variations FOR SELECT USING (true);
CREATE POLICY "Users can manage robot_variations" ON public.robot_variations FOR ALL USING (auth.uid() IS NOT NULL);

-- Core seed variations
INSERT INTO public.robot_variations 
(name, description, min_shots, min_shots_on_target, min_dangerous_attacks, min_possession, min_combined_shots)
VALUES 
('Pressão Moderada', 'Busca jogos com pressão ofensiva comum.', 4, 1, 15, 55, 6),
('Pressão Alta Unilateral', 'Um time massacrando o outro na janela de 10 minutos.', 6, 2, 25, 65, 0),
('Pressão Dupla', 'Ambos os times atacando muito (jogo aberto).', 0, 0, 30, 0, 10),
('Pressão + Estatística Prévia', 'Pressão aliada a alta chance de gols pré-live.', 3, 1, 15, 50, 4),
('Pressão Extrema', 'Filtro ultra agressivo para jogos com iminência real de gol.', 8, 3, 30, 70, 0)
ON CONFLICT DO NOTHING;

-- 3. Live Stats Snapshots (Temporary, self-cleaning via cron)
CREATE TABLE IF NOT EXISTS public.live_stats_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id text NOT NULL,
  minute integer NOT NULL,
  stats_json jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast delta lookup
CREATE INDEX IF NOT EXISTS idx_live_stats_snapshots_fixture_minute ON public.live_stats_snapshots(fixture_id, minute);

ALTER TABLE public.live_stats_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read live_stats_snapshots" ON public.live_stats_snapshots FOR SELECT USING (true);
CREATE POLICY "Cron can manage live_stats_snapshots" ON public.live_stats_snapshots FOR ALL USING (true);

-- 4. Tracking Dispatched Alerts
CREATE TABLE IF NOT EXISTS public.live_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fixture_id text NOT NULL,
  league_id text,
  league_name text,
  home_team text,
  away_team text,
  minute_at_alert integer NOT NULL,
  variation_id uuid REFERENCES public.robot_variations(id),
  variation_name text,
  stats_snapshot jsonb,
  goal_ht_result text DEFAULT 'pending', -- pending, green, red
  over15_result text DEFAULT 'pending',  -- pending, green, red
  final_score text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(fixture_id, variation_id)
);

ALTER TABLE public.live_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read live_alerts" ON public.live_alerts FOR SELECT USING (true);
CREATE POLICY "Users can manage live_alerts" ON public.live_alerts FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Cron can insert live_alerts" ON public.live_alerts FOR INSERT WITH CHECK (true);

-- 5. Execution Audit Logs (Temporary, self-cleaning to 3 days limit via cron)
CREATE TABLE IF NOT EXISTS public.robot_execution_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_time timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  fixture_id text NOT NULL,
  league_id text,
  variation_id uuid REFERENCES public.robot_variations(id),
  stage text NOT NULL, -- 'DISCARDED_PRE_FILTER', 'VARIATION_EVALUATION', 'FROZEN_API'
  reason text NOT NULL, -- e.g., 'Minuto fora da faixa', 'Liga Bloqueada', 'Passou', 'Falhou'
  details jsonb, -- e.g., which specific criteria failed
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for fast cleanup and frontend rendering
CREATE INDEX IF NOT EXISTS idx_robot_execution_logs_fixture_id ON public.robot_execution_logs(fixture_id);
CREATE INDEX IF NOT EXISTS idx_robot_execution_logs_execution_time ON public.robot_execution_logs(execution_time);

ALTER TABLE public.robot_execution_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read robot_execution_logs" ON public.robot_execution_logs FOR SELECT USING (true);
CREATE POLICY "Cron can manage robot_execution_logs" ON public.robot_execution_logs FOR ALL USING (true);
