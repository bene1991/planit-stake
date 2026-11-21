-- permite rodar o mesmo jogo com mais de uma instrução (variante) para comparar
ALTER TABLE public.ai_backtest ADD COLUMN IF NOT EXISTS variant text NOT NULL DEFAULT 'ancora';
ALTER TABLE public.ai_backtest DROP CONSTRAINT IF EXISTS ai_backtest_fixture_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS ai_backtest_fixture_variant_idx ON public.ai_backtest (fixture_id, variant);

-- os mesmos jogos já testados na variante 'ancora', ainda sem resultado na variante pedida
CREATE OR REPLACE FUNCTION public.ai_backtest_same(n int, v text)
RETURNS TABLE (alert_id uuid, fixture_id text, minute_at_alert int, stats jsonb, goal_events jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.fid, s.minute_at_alert, s.stats_snapshot, s.goal_events FROM (
    SELECT DISTINCT ON (a.fixture_id) a.id, a.fixture_id::text AS fid, a.minute_at_alert, a.stats_snapshot, a.goal_events
    FROM live_alerts a
    WHERE a.fixture_id::text IN (SELECT b.fixture_id FROM ai_backtest b WHERE b.variant = 'ancora')
      AND a.minute_at_alert BETWEEN 15 AND 49
      AND a.final_score ~ '^[0-9]+x[0-9]+$'
      AND a.stats_snapshot->'fullMatch'->'h' IS NOT NULL
      AND jsonb_array_length(COALESCE(a.goal_events, '[]'::jsonb)) = split_part(a.final_score,'x',1)::int + split_part(a.final_score,'x',2)::int
      AND NOT EXISTS (SELECT 1 FROM ai_backtest b2 WHERE b2.fixture_id = a.fixture_id::text AND b2.variant = v)
    ORDER BY a.fixture_id, a.minute_at_alert
  ) s ORDER BY md5(s.fid) LIMIT n
$$;
REVOKE EXECUTE ON FUNCTION public.ai_backtest_same(int, text) FROM PUBLIC, anon, authenticated;
