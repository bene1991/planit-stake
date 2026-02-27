-- Add team logo columns to lay0x1_analyses for logo persistence
ALTER TABLE public.lay0x1_analyses
ADD COLUMN IF NOT EXISTS home_team_logo text,
ADD COLUMN IF NOT EXISTS away_team_logo text;
