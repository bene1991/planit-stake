-- Migration: Cleanup betting filters and add 30-70 window tracking
-- Date: 2026-03-24

-- 1. Cleanup robot_variations
ALTER TABLE public.robot_variations 
  DROP COLUMN IF EXISTS min_over15_pre,
  DROP COLUMN IF EXISTS min_lambda_total;

-- 2. Cleanup live_alerts
ALTER TABLE public.live_alerts 
  DROP COLUMN IF EXISTS goal_ht_result,
  DROP COLUMN IF EXISTS over15_result,
  DROP COLUMN IF EXISTS under25_result,
  ADD COLUMN IF NOT EXISTS win_30_70 boolean; -- NULL = pending, true = goal in 30-70, false = no goal in 30-70

-- 3. Add index for resolution
CREATE INDEX IF NOT EXISTS idx_live_alerts_win_30_70 ON public.live_alerts(win_30_70) WHERE win_30_70 IS NULL;
