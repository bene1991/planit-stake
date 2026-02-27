-- Add financial tracking columns to lay0x1_analyses
ALTER TABLE lay0x1_analyses 
ADD COLUMN IF NOT EXISTS odd_used DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS liability DECIMAL(10,2) DEFAULT 1000,
ADD COLUMN IF NOT EXISTS stake DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS profit DECIMAL(10,2);

-- Update RLS if necessary (though they already exist for the table)
-- COMMENT: RLS policies for lay0x1_analyses already ensure owner_id check.
