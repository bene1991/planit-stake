import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixBadGoals() {
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
            
            let isBad = false;
            if (Array.isArray(events)) {
                for (const ev of events) {
                    if (ev.time && typeof ev.time.elapsed !== 'undefined') {
                        isBad = true;
                        break;
                    }
                }
                
                if (isBad) {
                    foundBad++;
                    const fixedEvents = events.map(g => {
                        if (g.time && typeof g.time.elapsed !== 'undefined') {
                            return {
                                team: g.team?.name || '',
                                detail: g.detail || 'Normal Goal',
                                minute: g.time.elapsed,
                                player: g.player?.name || '',
                                extra: g.time.extra
                            };
                        }
                        return g; 
                    });
                    
                    console.log(`Fixing fixture ${alert.fixture_id}...`);
                    const { error } = await supabase
                        .from('live_alerts')
                        .update({ goal_events: fixedEvents })
                        .eq('id', alert.id);
                        
                    if (error) {
                        console.error(`Failed to update ${alert.id}:`, error);
                    }
                }
            }
        } catch (e) {
            console.log(`JSON parse error in ${alert.fixture_id}:`, e);
        }
    }
    
    console.log(`Fixed ${foundBad} bad rows out of ${alerts.length}`);
}

fixBadGoals();
