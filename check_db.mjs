import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGames() {
    const { data: game, error } = await supabase
        .from('games')
        .select('*')
        .limit(1);
    
    console.log("Game columns:", Object.keys(game[0]));
    console.log("Game sample:", game[0]);

    const { data: alert, error: alertErr } = await supabase
        .from('live_alerts')
        .select('*')
        .limit(1);

    console.log("Alert columns:", Object.keys(alert[0]));
    console.log("Alert sample:", alert[0]);
}

checkGames();
