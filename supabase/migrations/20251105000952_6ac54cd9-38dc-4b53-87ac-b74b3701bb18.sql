-- Fix security warnings by setting search_path on functions

-- Update update_updated_at_column function with search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update set_game_date_time function with search_path
CREATE OR REPLACE FUNCTION public.set_game_date_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.date_time = (NEW.date || ' ' || NEW.time)::TIMESTAMP WITH TIME ZONE;
  RETURN NEW;
END;
$$;