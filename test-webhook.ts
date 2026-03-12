import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const webhookUrl = "https://script.google.com/macros/s/AKfycbzp1ZngBLwh8jwt7TZUGHgohQZSfd-Gpz1-vTISriNzd9YTGINO9ogqB318Vy-9Uqth/exec";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing credentials!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: alerts } = await supabase
    .from('live_alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (!alerts || alerts.length === 0) {
    console.log("No alerts found.");
    return;
  }

  for (const alert of alerts) {
    console.log(`Sending NEW_ALERT for ${alert.home_team} vs ${alert.away_team} (Fixture ID: ${alert.fixture_id})`);

    const d = new Date(alert.created_at);
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    // 1. Send Creation Event
    const createPayload = {
      action: 'NEW_ALERT',
      date: dateStr,
      match: `${alert.home_team} vs ${alert.away_team}`,
      league: alert.league_name,
      method: alert.variation_name || "Teste",
      alertMinute: String(alert.minute_at_alert || '0'),
      fixtureId: alert.fixture_id
    };

    console.log(createPayload);

    let res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload)
    });

    console.log("Create response:", await res.text());

    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    // 2. Send Update Event
    const goalsArr = typeof alert.goal_events === 'string' ? JSON.parse(alert.goal_events) : (alert.goal_events || []);
    const goalsStr = goalsArr.map((e: any) => `${e.minute}${e.extra ? '+' + e.extra : ''}'`).join(', ');
    const fs = alert.final_score || "0x0";

    const isGreen = alert.goal_ht_result === 'green' || alert.over15_result === 'green';
    const isPending = alert.goal_ht_result === 'pending' && alert.over15_result === 'pending';
    const result = isGreen ? 'GREEN' : isPending ? 'PENDENTE' : 'RED';

    console.log(`Sending UPDATE_ALERT for ${alert.home_team} vs ${alert.away_team}`);

    const updatePayload = {
      action: 'UPDATE_ALERT',
      fixtureId: alert.fixture_id,
      goalsInterval: goalsStr,
      finalScore: fs,
      result: result
    };

    console.log(updatePayload);

    res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload)
    });

    console.log("Update response:", await res.text());
    await new Promise(r => setTimeout(r, 2000));
  }
}

run();
