import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let configStrStr = '';
try { configStrStr = fs.readFileSync('/Users/vinicius/TRADE/planit-stake/.env.local', 'utf-8'); } catch(e) {}
if (!configStrStr) {
try { configStrStr = fs.readFileSync('/Users/vinicius/TRADE/planit-stake/.env', 'utf-8'); } catch(e) {}
}

const env = Object.fromEntries(configStrStr.split('\n').filter(line => line.includes('=')).map(line => {
  const [k, ...v] = line.split('=');
  return [k.trim(), v.join('=').trim().replace(/"/g, '')];
}));

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if(!serviceKey) {
  console.log("No key"); process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, serviceKey);

async function run() {
  // try inserting a dummy to see the error
  const { error } = await supabase.from('lay0x1_analyses').insert({
    owner_id: '00000000-0000-0000-0000-000000000000',
    fixture_id: 'TEST',
    home_team: 'H',
    away_team: 'A',
    league: 'L',
    date: '2026-02-28',
    score_value: 100,
    classification: 'Forte',
    criteria_snapshot: {},
    weights_snapshot: {},
    source_list: 'lista_padrao',
    is_backtest: false
  });
  console.log("Insert Test Error:", error);
}
run();
