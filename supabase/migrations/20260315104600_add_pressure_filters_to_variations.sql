-- Migration: Add pressure filter columns to robot_variations
-- Description: Adds min_corners, min_shots_insidebox, and min_expected_goals to allow more advanced filtering.

ALTER TABLE public.robot_variations 
ADD COLUMN IF NOT EXISTS min_corners INTEGER,
ADD COLUMN IF NOT EXISTS min_shots_insidebox INTEGER,
ADD COLUMN IF NOT EXISTS min_expected_goals DECIMAL;

-- Comment on columns for clarity
COMMENT ON COLUMN public.robot_variations.min_corners IS 'Minimum number of corners required for the alert';
COMMENT ON COLUMN public.robot_variations.min_shots_insidebox IS 'Minimum number of shots inside the box required for the alert';
COMMENT ON COLUMN public.robot_variations.min_expected_goals IS 'Minimum xG (expected goals) required for the alert';
