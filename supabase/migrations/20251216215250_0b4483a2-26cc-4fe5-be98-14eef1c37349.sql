-- Create table for user favorite leagues
CREATE TABLE public.user_favorite_leagues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  league_id INTEGER NOT NULL,
  league_name TEXT NOT NULL,
  country TEXT,
  logo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_favorite_leagues ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own favorite leagues" 
ON public.user_favorite_leagues 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own favorite leagues" 
ON public.user_favorite_leagues 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own favorite leagues" 
ON public.user_favorite_leagues 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Create unique constraint to prevent duplicates
CREATE UNIQUE INDEX idx_user_favorite_leagues_unique ON public.user_favorite_leagues (owner_id, league_id);