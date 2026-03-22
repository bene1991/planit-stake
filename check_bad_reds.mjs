import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  console.log('Fetching RED alerts to check...');
  const { data: alerts, error } = await sb.from('live_alerts')
    .select('id, fixture_id, home_team, away_team, goal_ht_result, final_score, goal_events')
    .eq('goal_ht_result', 'red')
    .not('goal_events', 'is', null);
  
  if (error) {
     console.error('Error fetching alerts:', error);
     process.exit(1);
  }

  if (!alerts || alerts.length === 0) {
    console.log('No RED alerts with goal_events found.');
    process.exit(0);
  }
  
  console.log(`Checking ${alerts.length} RED alerts for missing greens...`);
  
  const badReds = alerts.filter(a => {
    if (!a.goal_events || !Array.isArray(a.goal_events)) return false; 
    
    // Check if there are ANY goals between 30 and 70!
    const validGoals = a.goal_events.filter(e => e.minute >= 30 && e.minute <= 70);
    
    if (validGoals.length > 0) {
        return true;
    }
    return false;
  });
  
  console.log('Bad Red Alerts (Actually HAD goal in 30-70 window):', badReds.length);
  
  for (const a of badReds) {
    const validGoals = a.goal_events.filter(e => e.minute >= 30 && e.minute <= 70);
    const goalsInterval = validGoals.map(e => `${e.minute}'`).join(', ');
    
    console.log(`Fixing alert: ${a.id} (${a.home_team} vs ${a.away_team}) -> changing to GREEN. Gols: ${goalsInterval}`);
    
    await sb.from('live_alerts').update({ goal_ht_result: 'green' }).eq('id', a.id);
    
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbzp1ZngBLwh8jwt7TZUGHgohQZSfd-Gpz1-vTISriNzd9YTGINO9ogqB318Vy-9Uqth/exec';
    try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_ALERT',
            fixtureId: String(a.fixture_id),
            finalScore: a.final_score,
            result: 'green',
            goalsInterval: goalsInterval
          })
        });
    } catch (e) {
        console.error(`Error updating webhook for ${a.id}:`, e.message);
    }
  }
  
  console.log('Audit completed.');
}

run();
