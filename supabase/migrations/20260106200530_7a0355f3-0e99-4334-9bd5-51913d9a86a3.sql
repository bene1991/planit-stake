-- Add BTTS columns to games table for storing odds from The Odds API
ALTER TABLE public.games ADD COLUMN btts_yes NUMERIC;
ALTER TABLE public.games ADD COLUMN btts_no NUMERIC;
ALTER TABLE public.games ADD COLUMN btts_bookmaker TEXT;
ALTER TABLE public.games ADD COLUMN btts_is_betfair BOOLEAN DEFAULT FALSE;
ALTER TABLE public.games ADD COLUMN btts_fetched_at TIMESTAMP WITH TIME ZONE;