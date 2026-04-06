-- Migration to support delayed Telegram alerts based on a specific minute
-- Add column to robot_variations for target telegram minute
ALTER TABLE robot_variations ADD COLUMN IF NOT EXISTS telegram_alert_minute integer;

-- Add control column to live_alerts to track if telegram was sent
ALTER TABLE live_alerts ADD COLUMN IF NOT EXISTS telegram_sent boolean DEFAULT false;

-- Add cached target minute to live_alerts for historical accuracy
ALTER TABLE live_alerts ADD COLUMN IF NOT EXISTS telegram_alert_minute integer;

-- Update existing records to reflect they were already handled (if any)
UPDATE live_alerts SET telegram_sent = true WHERE telegram_sent IS NULL;
