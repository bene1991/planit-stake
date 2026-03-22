import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkBadGoals() {
    console.log("Fetching live_alerts with goal_events...")
    const { data: alerts, error: alertErr } = await supabase
        .from('live_alerts')
        .select('id, fixture_id, goal_events, created_at')
        .not('goal_events', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);
        
    let foundBad = 0;
    for (const alert of alerts) {
        if (!alert.goal_events) continue;
        
        const events = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : alert.goal_events;
        
        if (Array.isArray(events) && events.length > 0) {
            // Check if the first event has 'time' object instead of 'minute'
            if (events[0].time && events[0].time.elapsed) {
                console.log(`Bad format in ${alert.fixture_id} (${alert.created_at}):`, JSON.stringify(events[0]));
                foundBad++;
                if (foundBad >= 5) break;
            }
        }
    }
    
    if (foundBad === 0) {
        console.log("No bad format found in the first 100 recent rows.");
    }
}

checkBadGoals();
