-- Sinais de IA: uma linha por análise de jogo ao vivo (piloto nas ligas principais). Guarda custo e, depois, se saiu gol.
CREATE TABLE IF NOT EXISTS public.ai_game_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id text NOT NULL,
  league_id text,
  league_name text,
  home_team text,
  away_team text,
  minute int,
  score text,
  goals_total int,
  heat int,
  goal_chance int,
  level text,
  trend text,
  summary text,
  drivers jsonb,
  model text,
  tokens_in int,
  tokens_out int,
  cost_usd numeric,
  goal_next10 boolean,         -- preenchido depois: saiu gol nos 10 min seguintes? (null = ainda não dá para saber)
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_game_signals_fixture_idx ON public.ai_game_signals (fixture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_game_signals_created_idx ON public.ai_game_signals (created_at DESC);
ALTER TABLE public.ai_game_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ai_game_signals" ON public.ai_game_signals FOR SELECT USING (auth.uid() IS NOT NULL);
