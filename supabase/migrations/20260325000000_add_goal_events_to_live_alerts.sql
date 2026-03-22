-- Migration: Add goal_events to live_alerts for detailed reporting
-- Date: 2026-03-25

-- Add goal_events column to store minute-by-minute goal data
ALTER TABLE public.live_alerts 
ADD COLUMN IF NOT EXISTS goal_events jsonb DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.live_alerts.goal_events IS 'Persisted goal events (minute, extra, team, player, detail) for reporting';
