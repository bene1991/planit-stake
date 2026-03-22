-- Add bot_token to telegram_groups
ALTER TABLE public.telegram_groups 
ADD COLUMN IF NOT EXISTS bot_token text;

-- Create the Under 2,5 - Posse 65% variation
-- Using the group ID found earlier: e427c6d5-9a4a-44ad-925c-849e1814ecc4 (Under 2.5)
INSERT INTO public.robot_variations 
(name, description, min_possession, min_combined_shots, telegram_group_id, active, first_half_only, min_minute, max_minute)
VALUES 
('Under 2,5 - Posse 65%', 'Robô focado em Under 2.5 com posse de bola acima de 65%.', 65, 0, 'e427c6d5-9a4a-44ad-925c-849e1814ecc4', true, true, 15, 35)
ON CONFLICT DO NOTHING;
