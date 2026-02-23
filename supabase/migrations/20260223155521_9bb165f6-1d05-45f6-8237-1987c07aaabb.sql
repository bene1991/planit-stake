
-- Add ai_recommendations to calibration history
ALTER TABLE public.lay0x1_calibration_history 
ADD COLUMN ai_recommendations jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add min_score to weights for dynamic threshold
ALTER TABLE public.lay0x1_weights 
ADD COLUMN min_score numeric NOT NULL DEFAULT 65;
