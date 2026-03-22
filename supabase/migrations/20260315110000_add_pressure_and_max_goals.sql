-- Migration: Add missing pressure and max_goals columns to robot_variations
-- Description: Adds pressure_1, pressure_2, and max_goals for more granular alert control.

ALTER TABLE public.robot_variations 
ADD COLUMN IF NOT EXISTS pressure_1 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pressure_2 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_goals INTEGER;

-- Comment on columns for clarity
COMMENT ON COLUMN public.robot_variations.pressure_1 IS 'Pressure V1 filter (Home/V1 intensity)';
COMMENT ON COLUMN public.robot_variations.pressure_2 IS 'Pressure V2 filter (Away/V2 intensity)';
COMMENT ON COLUMN public.robot_variations.max_goals IS 'Maximum number of goals in the match for the alert to trigger';
