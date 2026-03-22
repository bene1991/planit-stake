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
        .order('created_at', { ascending: false });
        
    let foundBad = 0;
    for (const alert of alerts) {
        if (!alert.goal_events) continue;
        
        try {
            const events = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : alert.goal_events;
            
            if (Array.isArray(events)) {
                for (const ev of events) {
                    if (ev.time && ev.time.elapsed) {
                        console.log(`Bad format in ${alert.fixture_id} (${alert.created_at}):`, JSON.stringify(ev));
                        foundBad++;
                        break;
                    }
                }
            } else if (typeof events === 'object') {
                console.log(`Unexpected object format in ${alert.fixture_id} (${alert.created_at}):`, JSON.stringify(events));
            }
        } catch (e) {
            console.log(`JSON parse error in ${alert.fixture_id} (${alert.created_at}):`, alert.goal_events);
        }
    }
    
    console.log(`Found ${foundBad} bad rows out of ${alerts.length}`);
}

checkBadGoals();
