-- Teste da IA no histórico: jogos sorteados, só com estatísticas do momento do alerta (sem times nem liga), comparados com os gols que saíram.
CREATE TABLE IF NOT EXISTS public.ai_backtest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id text NOT NULL UNIQUE,
  alert_minute int,
  goals_before int,
  heat int,
  goal_chance int,
  level text,
  summary text,
  goal25 boolean,   -- saiu gol nos 25 minutos seguintes ao alerta?
  goal10 boolean,
  tokens_in int, tokens_out int, cost_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_backtest ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read ai_backtest" ON public.ai_backtest FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.ai_backtest_sample(n int)
RETURNS TABLE (alert_id uuid, fixture_id text, minute_at_alert int, stats jsonb, goal_events jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.fid, s.minute_at_alert, s.stats_snapshot, s.goal_events FROM (
    SELECT DISTINCT ON (a.fixture_id) a.id, a.fixture_id::text AS fid, a.minute_at_alert, a.stats_snapshot, a.goal_events
    FROM live_alerts a
    WHERE a.minute_at_alert BETWEEN 15 AND 49
      AND a.final_score ~ '^[0-9]+x[0-9]+$'
      AND a.stats_snapshot->'fullMatch'->'h' IS NOT NULL
      AND jsonb_array_length(COALESCE(a.goal_events, '[]'::jsonb)) = split_part(a.final_score,'x',1)::int + split_part(a.final_score,'x',2)::int
      AND NOT EXISTS (SELECT 1 FROM ai_backtest b WHERE b.fixture_id = a.fixture_id::text)
    ORDER BY a.fixture_id, a.minute_at_alert
  ) s ORDER BY md5(s.fid) LIMIT n
$$;
REVOKE EXECUTE ON FUNCTION public.ai_backtest_sample(int) FROM PUBLIC, anon, authenticated;
