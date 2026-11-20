-- odd de saída (fechar o lay) lida pelo robô no minuto de saída; usada para preencher a Operação ao vivo
CREATE TABLE IF NOT EXISTS public.polymarket_exit_odds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id text NOT NULL,
  method_id uuid NOT NULL,
  odd numeric NOT NULL,
  line numeric,
  minute int,
  source text NOT NULL DEFAULT 'robot', -- 'robot' (lida na hora) ou 'backfill' (reconstruída do histórico)
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fixture_id, method_id)
);
ALTER TABLE public.polymarket_exit_odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read polymarket_exit_odds" ON public.polymarket_exit_odds FOR SELECT USING (auth.uid() IS NOT NULL);
