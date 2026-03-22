import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGames() {
    const { data: alerts, error: alertErr } = await supabase
        .from('live_alerts')
        .select('id, fixture_id, goal_events, final_score')
        .not('final_score', 'is', null)
        .neq('final_score', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
        
    for (const alert of alerts) {
        if (alert.goal_events && alert.goal_events.length > 0) {
            console.log("Alert with goals:", JSON.stringify(alert, null, 2));
            break;
        }
    }

    const { data: games, error } = await supabase
        .from('games')
        .select('api_fixture_id, goal_events')
        .neq('goal_events', '[]')
        .limit(10);
    
    for (const game of games) {
        if (game.goal_events && game.goal_events.length > 0) {
            console.log("Game with goals:", JSON.stringify(game, null, 2));
            break;
        }
    }
}

checkGames();
