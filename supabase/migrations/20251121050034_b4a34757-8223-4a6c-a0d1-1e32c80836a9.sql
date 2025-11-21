-- Add google_sheets_url column to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS google_sheets_url TEXT;

COMMENT ON COLUMN public.settings.google_sheets_url IS 'URL da planilha Google Sheets para sincronização automática';