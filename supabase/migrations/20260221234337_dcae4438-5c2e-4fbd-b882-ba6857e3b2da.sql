
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create live_monitor_state table
CREATE TABLE public.live_monitor_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  fixture_id text NOT NULL,
  last_home_score integer DEFAULT 0,
  last_away_score integer DEFAULT 0,
  last_events_count integer DEFAULT 0,
  notified_events jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'monitoring',
  updated_at timestamptz DEFAULT now()
);

-- Create unique index on game_id to prevent duplicates
CREATE UNIQUE INDEX idx_live_monitor_state_game_id ON public.live_monitor_state(game_id);

-- Create index on status for faster queries
CREATE INDEX idx_live_monitor_state_status ON public.live_monitor_state(status);

-- Enable RLS
ALTER TABLE public.live_monitor_state ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view their own monitor state
CREATE POLICY "Users can view their own monitor state"
ON public.live_monitor_state FOR SELECT
USING (auth.uid() = owner_id);

-- RLS: Users can insert their own monitor state
CREATE POLICY "Users can insert their own monitor state"
ON public.live_monitor_state FOR INSERT
WITH CHECK (auth.uid() = owner_id);

-- RLS: Users can update their own monitor state
CREATE POLICY "Users can update their own monitor state"
ON public.live_monitor_state FOR UPDATE
USING (auth.uid() = owner_id);

-- RLS: Users can delete their own monitor state
CREATE POLICY "Users can delete their own monitor state"
ON public.live_monitor_state FOR DELETE
USING (auth.uid() = owner_id);

-- RLS: Service role full access (for the edge function)
CREATE POLICY "Service role full access live_monitor_state"
ON public.live_monitor_state FOR ALL
USING (auth.role() = 'service_role');
