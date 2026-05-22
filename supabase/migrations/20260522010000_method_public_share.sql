ALTER TABLE public.strategy_simulations
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE POLICY "Public can view shared simulations"
ON public.strategy_simulations FOR SELECT
USING (is_public = true);
