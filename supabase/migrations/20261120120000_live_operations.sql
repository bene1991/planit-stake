-- Operação ao vivo: o que o dono marcou como "entrei" e a odd de saída digitada, por jogo+método.
CREATE TABLE IF NOT EXISTS public.live_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  fixture_id text NOT NULL,
  method_id uuid NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  entry_odd numeric,   -- odd em que o dono entrou (padrão: a lida pelo robô)
  exit_odd numeric,    -- odd de saída digitada; se nula, vale o red do método
  UNIQUE (owner_id, fixture_id, method_id)
);
ALTER TABLE public.live_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages live_operations" ON public.live_operations;
CREATE POLICY "Owner manages live_operations" ON public.live_operations
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
