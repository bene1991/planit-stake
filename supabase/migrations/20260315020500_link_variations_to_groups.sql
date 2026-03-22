-- Add telegram_group_id to robot_variations
ALTER TABLE public.robot_variations 
ADD COLUMN IF NOT EXISTS telegram_group_id UUID REFERENCES public.telegram_groups(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_robot_variations_telegram_group_id ON public.robot_variations(telegram_group_id);

-- Optional: Migrate existing telegram_chat_id data if it matches a group
-- This is tricky because we don't have the groups yet, but let's assume 
-- the user will create them.
