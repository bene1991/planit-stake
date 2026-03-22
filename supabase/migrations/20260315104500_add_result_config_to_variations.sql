-- Migration: Add result and void configuration to robot_variations
-- Description: Allows each robot variation to have its own logic for Green/Red and Void results.

ALTER TABLE public.robot_variations 
ADD COLUMN IF NOT EXISTS result_type TEXT DEFAULT 'OVER_GOALS',
ADD COLUMN IF NOT EXISTS result_config JSONB DEFAULT '{"min_goals": 1, "target_market": "OVER_15"}'::jsonb,
ADD COLUMN IF NOT EXISTS void_config JSONB DEFAULT '{}'::jsonb;

-- Comment on columns for clarity
COMMENT ON COLUMN public.robot_variations.result_type IS 'Type of validation: OVER_GOALS, UNDER_GOALS, TIME_WINDOW_GOAL';
COMMENT ON COLUMN public.robot_variations.result_config IS 'Parameters for the result type (e.g., min_minute, max_minute, goals)';
COMMENT ON COLUMN public.robot_variations.void_config IS 'Conditions to void the alert (e.g., void_if_goal_before_minute)';
