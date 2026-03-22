-- Migration to support Under 2.5 and configuration columns

-- Add columns to live_alerts
ALTER TABLE live_alerts ADD COLUMN IF NOT EXISTS under25_result text DEFAULT 'pending';

-- Add columns to robot_variations
ALTER TABLE robot_variations ADD COLUMN IF NOT EXISTS result_type text DEFAULT 'OVER_GOALS';
ALTER TABLE robot_variations ADD COLUMN IF NOT EXISTS max_goals integer;

-- Add webhook_status to live_alerts if not exists
ALTER TABLE live_alerts ADD COLUMN IF NOT EXISTS webhook_status text DEFAULT 'pending';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_live_alerts_under25_result ON live_alerts(under25_result);
