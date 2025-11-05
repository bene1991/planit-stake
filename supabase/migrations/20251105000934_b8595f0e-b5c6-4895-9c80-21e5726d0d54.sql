-- Create tables with owner_id field

-- Bankroll table
CREATE TABLE IF NOT EXISTS public.bankroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total DECIMAL(12, 2) NOT NULL DEFAULT 10000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Methods table
CREATE TABLE IF NOT EXISTS public.methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Games table
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'Not Started',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Method operations table
CREATE TABLE IF NOT EXISTS public.method_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  method_id UUID NOT NULL REFERENCES public.methods(id) ON DELETE CASCADE,
  operation_type TEXT CHECK (operation_type IN ('Back', 'Lay')),
  entry_odds DECIMAL(10, 2),
  exit_odds DECIMAL(10, 2),
  result TEXT CHECK (result IN ('Green', 'Red')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bankroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.method_operations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bankroll
CREATE POLICY "Users can view their own bankroll"
  ON public.bankroll FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own bankroll"
  ON public.bankroll FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own bankroll"
  ON public.bankroll FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own bankroll"
  ON public.bankroll FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for methods
CREATE POLICY "Users can view their own methods"
  ON public.methods FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own methods"
  ON public.methods FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own methods"
  ON public.methods FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own methods"
  ON public.methods FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for games
CREATE POLICY "Users can view their own games"
  ON public.games FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own games"
  ON public.games FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own games"
  ON public.games FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own games"
  ON public.games FOR DELETE
  USING (auth.uid() = owner_id);

-- RLS Policies for method_operations (via game ownership)
CREATE POLICY "Users can view operations of their own games"
  ON public.method_operations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = method_operations.game_id 
    AND games.owner_id = auth.uid()
  ));

CREATE POLICY "Users can insert operations for their own games"
  ON public.method_operations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = method_operations.game_id 
    AND games.owner_id = auth.uid()
  ));

CREATE POLICY "Users can update operations of their own games"
  ON public.method_operations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = method_operations.game_id 
    AND games.owner_id = auth.uid()
  ));

CREATE POLICY "Users can delete operations of their own games"
  ON public.method_operations FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.games 
    WHERE games.id = method_operations.game_id 
    AND games.owner_id = auth.uid()
  ));

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_bankroll_updated_at
  BEFORE UPDATE ON public.bankroll
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_methods_updated_at
  BEFORE UPDATE ON public.methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_method_operations_updated_at
  BEFORE UPDATE ON public.method_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to auto-populate date_time from date and time
CREATE OR REPLACE FUNCTION public.set_game_date_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.date_time = (NEW.date || ' ' || NEW.time)::TIMESTAMP WITH TIME ZONE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_game_date_time_trigger
  BEFORE INSERT OR UPDATE ON public.games
  FOR EACH ROW
  EXECUTE FUNCTION public.set_game_date_time();