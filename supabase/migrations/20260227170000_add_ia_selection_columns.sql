-- 1. Add source_list to lay0x1_analyses (lista_padrao | ia_selection)
ALTER TABLE public.lay0x1_analyses
  ADD COLUMN IF NOT EXISTS source_list text NOT NULL DEFAULT 'lista_padrao';

-- 2. Add ia_justification text
ALTER TABLE public.lay0x1_analyses
  ADD COLUMN IF NOT EXISTS ia_justification text;

-- 3. Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_lay0x1_analyses_source
  ON public.lay0x1_analyses(source_list);

-- 4. Extend stats cache with new IA fields
ALTER TABLE public.lay0x1_stats_cache
  ADD COLUMN IF NOT EXISTS btts_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS over25_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS home_clean_sheet_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS away_clean_sheet_pct numeric DEFAULT 0;
