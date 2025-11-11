-- Add last_import_date to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS last_import_date TIMESTAMP WITH TIME ZONE;