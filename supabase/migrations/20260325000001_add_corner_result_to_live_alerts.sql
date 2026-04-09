-- Migration: Add corner_result to live_alerts
-- Date: 2026-03-25

ALTER TABLE public.live_alerts 
ADD COLUMN IF NOT EXISTS corner_result integer;

COMMENT ON COLUMN public.live_alerts.corner_result IS 'Final corner count for the fixture';
