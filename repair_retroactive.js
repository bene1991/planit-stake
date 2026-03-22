import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Service Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function repairRetroactive() {
  console.log("Fetching pending alerts...");
  
  // 1. Fetch pending alerts from the last 2 days
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  const { data: alerts, error: alertsError } = await supabase
    .from('live_alerts')
    .select('id, fixture_id, final_score')
    .or('final_score.eq.pending,final_score.is.null,final_score.eq.""')
    .gte('created_at', twoDaysAgo.toISOString());

  if (alertsError) {
    console.error("Error fetching alerts:", alertsError);
    return;
  }

  console.log(`Found ${alerts.length} pending alerts.`);

  if (alerts.length === 0) return;

  // 2. Map fixture IDs for bulk fetching games
  const fixtureIds = [...new Set(alerts.map(a => a.fixture_id))];
  
  console.log(`Checking ${fixtureIds.length} unique fixtures in games table...`);

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('api_fixture_id, status, final_score_home, final_score_away')
    .in('api_fixture_id', fixtureIds.map(id => parseInt(id)))
    .eq('status', 'Finished');

  if (gamesError) {
    console.error("Error fetching games:", gamesError);
    return;
  }

  console.log(`Found ${games.length} finished games matching alerts.`);

  const gamesMap = new Map(games.map(g => [g.api_fixture_id.toString(), g]));

  // 3. Update alerts
  let updatedCount = 0;
  for (const alert of alerts) {
    const game = gamesMap.get(alert.fixture_id);
    
    if (game) {
      const finalScore = `${game.final_score_home}x${game.final_score_away}`;
      const over15 = (game.final_score_home + game.final_score_away) >= 2 ? 'green' : 'red';
      const win3070 = (game.final_score_home + game.final_score_away) === 0 ? false : undefined;

      const updateData = {
        final_score: finalScore,
        over15_result: over15,
        updated_at: new Date().toISOString()
      };

      if (win3070 !== undefined) {
        updateData.win_30_70 = win3070;
      }

      const { error: updateError } = await supabase
        .from('live_alerts')
        .update(updateData)
        .eq('id', alert.id);

      if (updateError) {
        console.error(`Error updating alert ${alert.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} alerts.`);
}

repairRetroactive();
