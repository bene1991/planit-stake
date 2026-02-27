-- Migration to add is_backtest column to lay0x1_analyses
ALTER TABLE public.lay0x1_analyses ADD COLUMN IF NOT EXISTS is_backtest boolean NOT NULL DEFAULT false;

-- Add index for performance in calibration filtering
CREATE INDEX IF NOT EXISTS idx_lay0x1_analyses_is_backtest ON public.lay0x1_analyses(is_backtest);

-- Update existing records: if result exists and resolved_at is set, we can't be 100% sure, 
-- but usually backtests are saved in batches. We leave current as real (false) by default.
