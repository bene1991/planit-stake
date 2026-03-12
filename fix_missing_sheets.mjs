import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envConfig = fs.readFileSync('.env', 'utf-8')
  .split('\n')
  .filter(line => line.includes('='))
  .reduce((acc, line) => {
    const [key, ...rest] = line.split('=');
    acc[key.trim()] = rest.join('=').replace(/"/g, '').trim();
    return acc;
  }, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://zswefmaedkdvbzakuzod.supabase.co';
const supabaseKey = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const PENDING_GAMES = ["1398607", "1398609"];

async function main() {
  for (const fId of PENDING_GAMES) {
    console.log(`Buscando dados da partida ${fId} no DB...`);
    const { data, error } = await supabase.from('live_alerts').select('*').eq('fixture_id', fId).limit(1);

    if (error) { console.error('DB Error:', error); continue; }

    const alert = data && data[0] ? data[0] : null;
    if (!alert) { console.log('Não encontrado no DB local'); continue; }

    const evt = alert.goal_events || [];
    const apiGoalEvents = evt.filter(e => e.minute).map(e => ({ minute: e.minute, extra: e.extra }));
    const goalsStr = apiGoalEvents.map((e) => `${e.minute}${e.extra ? '+' + e.extra : ''}'`).join(', ');

    const hasGoalInWindow = apiGoalEvents.some((e) => e.minute >= 30 && e.minute <= 70);
    const sheetResult = hasGoalInWindow ? 'GREEN' : 'RED';
    const finalScore = alert.final_score || 'Desconhecido';

    console.log(`[${fId}] Placar: ${finalScore} | Gols: ${goalsStr} | Status: ${sheetResult}`);

    try {
      const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';
      const req = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ALERT',
          fixtureId: fId,
          goalsInterval: goalsStr,
          finalScore: finalScore,
          result: sheetResult
        })
      });
      console.log(`Webhook disparado, status: ${req.status}`);
    } catch (e) {
      console.error(`Erro ao disparar webhook:`, e);
    }
  }
}
main();
