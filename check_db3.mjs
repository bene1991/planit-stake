import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkGames() {
    const { data: games, error } = await supabase
        .from('games')
        .select('api_fixture_id, goal_events')
        .order('created_at', { ascending: false })
        .limit(10);
    
    console.log("Recent games:", JSON.stringify(games, null, 2));
}

checkGames();
