
CREATE TABLE public.lay0x1_calibration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  cycle_number integer NOT NULL DEFAULT 1,
  trigger_type text NOT NULL DEFAULT 'auto_30',
  total_analyses integer NOT NULL DEFAULT 0,
  general_rate numeric NOT NULL DEFAULT 0,
  old_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  old_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_thresholds jsonb NOT NULL DEFAULT '{}'::jsonb,
  criterion_rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  threshold_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  patterns_detected jsonb NOT NULL DEFAULT '{}'::jsonb,
  changes_summary text[] NOT NULL DEFAULT '{}'::text[],
  forced_rebalance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lay0x1_calibration_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own calibration history"
  ON public.lay0x1_calibration_history FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert own calibration history"
  ON public.lay0x1_calibration_history FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_lay0x1_calibration_history_owner
  ON public.lay0x1_calibration_history (owner_id, created_at DESC);
