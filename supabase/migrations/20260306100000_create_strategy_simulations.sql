-- Create strategy_simulations table
CREATE TABLE IF NOT EXISTS public.strategy_simulations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  entry_minute integer NOT NULL,
  exit_minute integer NOT NULL,
  dataset_size integer NOT NULL,
  games_analyzed integer NOT NULL,
  greens integer NOT NULL,
  reds integer NOT NULL,
  goals_in_window integer NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL,
  total_stakes numeric NOT NULL,
  avg_profit numeric NOT NULL,
  roi numeric NOT NULL,
  filters_snapshot jsonb NOT NULL,
  simulation_version text DEFAULT 'v1',
  user_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.strategy_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own simulations"
ON public.strategy_simulations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own simulations"
ON public.strategy_simulations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own simulations"
ON public.strategy_simulations FOR DELETE
USING (auth.uid() = user_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_strategy_simulations_user_id ON public.strategy_simulations(user_id);
