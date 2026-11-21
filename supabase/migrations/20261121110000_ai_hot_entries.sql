-- Entrada = primeiro momento em que o jogo ficou quente. Fica aberta até o fim da janela (25 min) e é resolvida com "saiu gol" ou "não saiu gol".
CREATE TABLE IF NOT EXISTS public.ai_hot_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id text NOT NULL,
  reading_id uuid,
  league_name text, home_team text, away_team text,
  minute int NOT NULL,              -- minuto da entrada
  window_end int NOT NULL,          -- minuto em que a janela fecha (entrada + 25)
  score text, goals_total int NOT NULL DEFAULT 0,
  heat int, goal_chance int,
  line numeric, over_back_odd numeric, market_p25 int, edge int,
  status text NOT NULL DEFAULT 'aberta',   -- aberta | gol | sem_gol | indefinida
  goal_minute int,
  final_goals int,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS ai_hot_entries_status_idx ON public.ai_hot_entries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_hot_entries_fixture_idx ON public.ai_hot_entries (fixture_id, created_at DESC);
ALTER TABLE public.ai_hot_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ai_hot_entries" ON public.ai_hot_entries FOR SELECT USING (auth.uid() IS NOT NULL);
