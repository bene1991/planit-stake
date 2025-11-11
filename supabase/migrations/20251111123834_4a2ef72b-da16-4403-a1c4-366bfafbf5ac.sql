-- Create table for daily games (imported games before adding to planning)
CREATE TABLE public.daily_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_logo TEXT,
  away_team_logo TEXT,
  status TEXT DEFAULT 'Not Started',
  added_to_planning BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_games ENABLE ROW LEVEL SECURITY;

-- Create policies for daily_games
CREATE POLICY "Users can view their own daily games" 
ON public.daily_games 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own daily games" 
ON public.daily_games 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own daily games" 
ON public.daily_games 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own daily games" 
ON public.daily_games 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_games_updated_at
BEFORE UPDATE ON public.daily_games
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically set date_time
CREATE TRIGGER set_daily_games_date_time
BEFORE INSERT OR UPDATE ON public.daily_games
FOR EACH ROW
EXECUTE FUNCTION public.set_game_date_time();