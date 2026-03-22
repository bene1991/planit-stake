-- migration for auto-repairing live alerts from games table updates

-- 1. Create the sync function
CREATE OR REPLACE FUNCTION public.fn_sync_game_result_to_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if the game is finished
    IF NEW.status = 'Finished' THEN
        -- Update related live_alerts
        UPDATE public.live_alerts
        SET 
            final_score = NEW.final_score_home || 'x' || NEW.final_score_away,
            over15_result = CASE 
                WHEN (NEW.final_score_home + NEW.final_score_away) >= 2 THEN 'green'
                ELSE 'red'
            END,
            -- If the game ended 0x0, we can also resolve win_30_70 as false (no goal in 30-70 window)
            win_30_70 = CASE
                WHEN (NEW.final_score_home + NEW.final_score_away) = 0 THEN false
                ELSE win_30_70
            END,
            updated_at = now()
        WHERE fixture_id = NEW.api_fixture_id::text
        AND (final_score = 'pending' OR final_score IS NULL OR final_score = '');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tg_sync_game_result_to_alerts ON public.games;
CREATE TRIGGER tg_sync_game_result_to_alerts
AFTER UPDATE ON public.games
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Finished')
EXECUTE FUNCTION public.fn_sync_game_result_to_alerts();
