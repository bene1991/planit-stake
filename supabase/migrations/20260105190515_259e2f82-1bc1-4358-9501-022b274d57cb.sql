-- Add goal_events column to persist goal data after games end
ALTER TABLE public.games 
ADD COLUMN goal_events jsonb DEFAULT '[]'::jsonb;

-- Add final score columns for reference
ALTER TABLE public.games 
ADD COLUMN final_score_home integer DEFAULT NULL,
ADD COLUMN final_score_away integer DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.games.goal_events IS 'Persisted goal events from API-Football (type Goal only) with player name, minute, team_id';