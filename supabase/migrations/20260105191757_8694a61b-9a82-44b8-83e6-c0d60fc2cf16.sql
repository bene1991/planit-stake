-- Add financial columns to method_operations
ALTER TABLE method_operations
ADD COLUMN IF NOT EXISTS stake_value NUMERIC,
ADD COLUMN IF NOT EXISTS odd NUMERIC,
ADD COLUMN IF NOT EXISTS profit NUMERIC,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.045;

-- Create operational_settings table
CREATE TABLE IF NOT EXISTS operational_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  meta_mensal_stakes NUMERIC DEFAULT 30,
  stop_diario_stakes NUMERIC DEFAULT 3,
  devolucao_maxima_percent NUMERIC DEFAULT 50,
  commission_rate NUMERIC DEFAULT 0.045,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id)
);

-- Enable RLS
ALTER TABLE operational_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operational_settings
CREATE POLICY "Users can view their own operational settings"
ON operational_settings FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own operational settings"
ON operational_settings FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own operational settings"
ON operational_settings FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own operational settings"
ON operational_settings FOR DELETE
USING (auth.uid() = owner_id);