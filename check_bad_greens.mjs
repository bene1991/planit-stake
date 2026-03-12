import { createClient } from '@supabase/supabase-js';

async function run() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  
  const { data: alerts } = await sb.from('live_alerts').select('id, fixture_id, home_team, away_team, goal_ht_result, final_score, goal_events').eq('goal_ht_result', 'green');
  
  if (!alerts) {
    console.log('No alerts found');
    process.exit(0);
  }
  
  const badAlerts = alerts.filter(a => {
    if (!a.goal_events || !Array.isArray(a.goal_events)) return false; 
    
    // Check if there are ANY goals between 30 and 70!
    const validGoals = a.goal_events.filter(e => e.minute >= 30 && e.minute <= 70);
    
    if (validGoals.length === 0) {
        return true;
    }
    return false;
  });
  
  console.log('Bad Green Alerts (No goal in 30-70 window):', badAlerts.length);
  badAlerts.forEach(a => {
    console.log(a.id, a.fixture_id, a.home_team, 'vs', a.away_team, 'Score:', a.final_score, 'Events:', JSON.stringify(a.goal_events));
  });
  
  for (const a of badAlerts) {
    console.log('Fixing alert:', a.id);
    await sb.from('live_alerts').update({ goal_ht_result: 'red' }).eq('id', a.id);
    // Notify google sheets webhook?
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbzp1ZngBLwh8jwt7TZUGHgohQZSfd-Gpz1-vTISriNzd9YTGINO9ogqB318Vy-9Uqth/exec';
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_ALERT',
        fixtureId: String(a.fixture_id),
        finalScore: a.final_score,
        result: 'red',
        goalsInterval: ''
      })
    });
  }
  process.exit(0);
}

run();
