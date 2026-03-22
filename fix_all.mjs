import { createClient } from '@supabase/supabase-js';

async function run() {
  const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  
  console.log('Fetching greens...');
  const { data: alerts } = await sb.from('live_alerts').select('id, fixture_id, home_team, away_team, goal_ht_result, final_score, goal_events').eq('goal_ht_result', 'green');
  
  if (!alerts) {
    console.log('No alerts found');
    process.exit(0);
  }
  
  const badAlerts = alerts.filter(a => {
    if (!a.goal_events || !Array.isArray(a.goal_events)) {
      if (a.final_score === '0x0') return true;
      return false; // Can't be sure without fetching API, assume ok or fetch later
    }
    
    const isRealGoal = (evt) => {
        if (evt.type !== 'Goal') return false;
        const varCancellation = a.goal_events.find((v) => 
            v.type === 'Var' && 
            (v.detail?.toLowerCase().includes('cancel') || v.detail?.toLowerCase().includes('disallow')) &&
            v.minute === evt.minute &&
            v.team === evt.team
        );
        if (varCancellation) return false;
        if (evt.detail === 'Missed Penalty') return false;
        return true;
    }

    const realGoals = a.goal_events.filter(isRealGoal);
    const validGoals = realGoals.filter(e => e.minute >= 30 && e.minute <= 70);
    
    if (validGoals.length === 0) {
        return true; // Marked green but has no goals in 30-70 window
    }
    return false;
  });
  
  console.log('Found', badAlerts.length, 'bad green alerts needing fix to RED');
  
  for (let i = 0; i < badAlerts.length; i++) {
    const a = badAlerts[i];
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${i+1}/${badAlerts.length}] Fixing: ${a.fixture_id} ${a.home_team} vs ${a.away_team} - RED`);
    
    try {
      const { error: updateError } = await sb.from('live_alerts').update({ goal_ht_result: 'red' }).eq('id', a.id);
      if (updateError) console.error(`[${timestamp}] Supabase update error:`, updateError);

      const webhookUrl = 'https://script.google.com/macros/s/AKfycbxruR8yWA91z_vnHKGBgB5C6_M8yIXXdtMPz8I2EiV777QlA6iIDfEH2_QyVyMYp74E/exec';
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ALERT',
          fixtureId: String(a.fixture_id),
          finalScore: a.final_score || '',
          goalsInterval: ''
        })
      });
      if (!response.ok) {
        console.warn(`[${timestamp}] Webhook returned status ${response.status}`);
      }
    } catch(e) {
      console.error(`[${timestamp}] Error in loop for ${a.fixture_id}:`, e.message);
    }
    
    await new Promise(r => setTimeout(r, 500)); // Increased delay to avoid bottlenecks
  }
  
  console.log('Done fixing greens to red!');
  
  // Also check REDs to GREEN!
  const { data: reds } = await sb.from('live_alerts').select('id, fixture_id, home_team, away_team, goal_ht_result, final_score, goal_events').eq('goal_ht_result', 'red');
  const badReds = (reds||[]).filter(a => {
    if (!a.goal_events || !Array.isArray(a.goal_events)) return false; 
    const isRealGoal = (evt) => {
        if (evt.type !== 'Goal') return false;
        const varCancellation = a.goal_events.find((v) => 
            v.type === 'Var' && 
            (v.detail?.toLowerCase().includes('cancel') || v.detail?.toLowerCase().includes('disallow')) &&
            v.minute === evt.minute &&
            v.team === evt.team
        );
        if (varCancellation) return false;
        if (evt.detail === 'Missed Penalty') return false;
        return true;
    }
    const realGoals = a.goal_events.filter(isRealGoal);
    const validGoals = realGoals.filter(e => e.minute >= 30 && e.minute <= 70);
    if (validGoals.length > 0) return true;
    return false;
  });

  console.log('Found', badReds.length, 'bad red alerts needing fix to GREEN');
  for (let i = 0; i < badReds.length; i++) {
    const a = badReds[i];
    console.log(`[${i+1}/${badReds.length}] Fixing: ${a.fixture_id} ${a.home_team} vs ${a.away_team} - GREEN`);
    await sb.from('live_alerts').update({ goal_ht_result: 'green' }).eq('id', a.id);
    
    try {
      const webhookUrl = 'https://script.google.com/macros/s/AKfycbxruR8yWA91z_vnHKGBgB5C6_M8yIXXdtMPz8I2EiV777QlA6iIDfEH2_QyVyMYp74E/exec';
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ALERT',
          fixtureId: String(a.fixture_id),
          finalScore: a.final_score || '',
          goalsInterval: '' // probably want to compute this, but ok
        })
      });
    } catch(e) {
      console.error(`Error in loop for ${a.fixture_id}:`, e.message);
    }
    
    await new Promise(r => setTimeout(r, 500)); // Increased delay
  }
  
  console.log('Finished everything.');
  process.exit(0);
}
run();
