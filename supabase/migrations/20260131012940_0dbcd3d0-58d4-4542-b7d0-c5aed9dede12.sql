-- Create table for monthly reports (month closing)
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  year_month TEXT NOT NULL,
  total_operations INTEGER NOT NULL DEFAULT 0,
  greens INTEGER NOT NULL DEFAULT 0,
  reds INTEGER NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  profit_money NUMERIC NOT NULL DEFAULT 0,
  profit_stakes NUMERIC NOT NULL DEFAULT 0,
  max_drawdown NUMERIC NOT NULL DEFAULT 0,
  max_green_streak INTEGER NOT NULL DEFAULT 0,
  max_red_streak INTEGER NOT NULL DEFAULT 0,
  best_day_profit NUMERIC,
  worst_day_profit NUMERIC,
  best_method_name TEXT,
  best_method_profit NUMERIC,
  ai_score NUMERIC,
  ai_summary TEXT,
  ai_positive_points JSONB DEFAULT '[]'::jsonb,
  ai_negative_points JSONB DEFAULT '[]'::jsonb,
  ai_suggestions JSONB DEFAULT '[]'::jsonb,
  closed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own monthly reports"
ON monthly_reports FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own monthly reports"
ON monthly_reports FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own monthly reports"
ON monthly_reports FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own monthly reports"
ON monthly_reports FOR DELETE
USING (auth.uid() = owner_id);

-- Unique index per user/month to prevent duplicates
CREATE UNIQUE INDEX idx_monthly_reports_owner_month 
ON monthly_reports(owner_id, year_month);