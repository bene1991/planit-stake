import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function callApiFootball(endpoint, params) {
  const url = `${SUPABASE_URL}/functions/v1/api-football`;
  // Usando a chave legada que está no código da função para garantir acesso
  const legacyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': legacyKey,
      'Authorization': `Bearer ${legacyKey}`,
    },
    body: JSON.stringify({ endpoint, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json;
}

async function forceSync() {
  console.log("Starting Deep Force Sync for Today's Alerts...");
  
  // Get today's date in ISO
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const { data: alerts, error } = await supabase
    .from('live_alerts')
    .select('*')
    .gte('created_at', todayISO)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching alerts:", error);
    return;
  }

  console.log(`Found ${alerts.length} alerts to sync.`);

  for (const alert of alerts) {
    try {
      console.log(`Checking alert ${alert.id} (Fixture ${alert.fixture_id}) - ${alert.home_team} vs ${alert.away_team}`);
      
      const apiData = await callApiFootball('fixtures', { id: alert.fixture_id });
      
      if (!apiData || !apiData.response || apiData.response.length === 0) {
        console.warn(`No data for fixture ${alert.fixture_id}`);
        continue;
      }

      const fixture = apiData.response[0];
      const status = fixture.fixture.status.short; // FT, HT, 1H, etc
      const goals = fixture.goals;
      const score = fixture.score;
      const events = fixture.events || [];

      const currentScore = `${goals.home}x${goals.away}`;
      const htScore = score.halftime.home !== null ? `${score.halftime.home}x${score.halftime.away}` : null;
      
      // Goal events
      const goalEvents = events.filter(e => e.type === 'Goal');

      // Determination of results
      let htResult = alert.goal_ht_result;
      let over15Result = alert.over15_result;
      let finalScore = alert.final_score;

      // Se o tempo passou do HT (status HT, 2H, FT, etc)
      const finishedHt = !['1H', 'TBD', 'NS'].includes(status);
      if (finishedHt && htScore) {
          const [h, a] = htScore.split('x').map(Number);
          htResult = (h + a > 0) ? 'green' : 'red';
      }

      // Se o jogo acabou ou tem mais de 2 gols
      const totalGoals = (goals.home || 0) + (goals.away || 0);
      if (totalGoals >= 2) {
          over15Result = 'green';
      } else if (['FT', 'AET', 'PEN'].includes(status)) {
          over15Result = 'red';
      }

      // Se o jogo acabou, setamos finalScore
      if (['FT', 'AET', 'PEN'].includes(status)) {
          finalScore = currentScore;
      }

      const { error: updateError } = await supabase
        .from('live_alerts')
        .update({
          final_score: finalScore,
          goal_ht_result: htResult,
          over15_result: over15Result,
          goal_events: JSON.stringify(goalEvents), // This IS CRITICAL for simulation
          updated_at: new Date().toISOString()
        })
        .eq('id', alert.id);

      if (updateError) {
        console.error(`Error updating alert ${alert.id}:`, updateError);
      } else {
        console.log(`Updated alert ${alert.id} successfully. Score: ${currentScore}`);
      }

    } catch (e) {
      console.error(`Failed to sync alert ${alert.id}:`, e.message);
    }
  }

  console.log("Deep Force Sync completed.");
}

forceSync();
