-- Migration: Add HT score and improvement tracking to live_alerts
-- Date: 2026-03-20

-- Add ht_score to capture the exact halftime score (e.g., "1x0")
ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS ht_score text;

-- Add goal_events_captured to track if we already have the goal minutes synchronized
-- This helps in avoiding repeated heavy API calls for already resolved goals
ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS goal_events_captured boolean DEFAULT false;

-- Index for performance on resolution queries
CREATE INDEX IF NOT EXISTS idx_live_alerts_goal_events_captured ON public.live_alerts(goal_events_captured);
