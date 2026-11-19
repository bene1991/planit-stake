-- Leituras de odd do Polymarket no momento de cada notificação (modo sombra: só leitura de preço).
CREATE TABLE IF NOT EXISTS public.polymarket_snapshots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  fixture_id text NOT NULL,
  method_id uuid,
  method_name text,
  variation_id uuid,
  minute integer,
  home_team text,
  away_team text,
  league_name text,
  goals_total integer,
  found boolean NOT NULL,
  line numeric,
  odd numeric,            -- odd do lay no Under
  red numeric,            -- liability por 1 de green
  method_red numeric,     -- red que o método assume
  liq_best numeric,       -- stake disponível na melhor odd (US$)
  liq_top3 numeric,       -- stake disponível nas 3 melhores (US$)
  event_slug text
);
CREATE INDEX IF NOT EXISTS polymarket_snapshots_created_idx ON public.polymarket_snapshots (created_at DESC);
CREATE INDEX IF NOT EXISTS polymarket_snapshots_fixture_idx ON public.polymarket_snapshots (fixture_id);
ALTER TABLE public.polymarket_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read polymarket_snapshots" ON public.polymarket_snapshots;
CREATE POLICY "Authenticated read polymarket_snapshots" ON public.polymarket_snapshots FOR SELECT USING (auth.uid() IS NOT NULL);
