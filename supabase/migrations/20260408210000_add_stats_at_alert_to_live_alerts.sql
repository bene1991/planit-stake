-- Add stats_at_alert column to live_alerts table
ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS stats_at_alert jsonb DEFAULT '{}'::jsonb;
