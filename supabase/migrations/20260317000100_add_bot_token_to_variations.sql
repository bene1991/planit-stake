-- Add telegram_bot_token to robot_variations to allow overrides
ALTER TABLE public.robot_variations 
ADD COLUMN IF NOT EXISTS telegram_bot_token text;

-- Fix the select in the code by ensuring column names are consistent
-- This migration doesn't change code, but documents the schema expectations
