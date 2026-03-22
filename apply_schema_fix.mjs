import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFixes() {
  console.log('Applying schema fixes to live_alerts...');

  const queries = [
    'ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS ht_score text;',
    'ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS goal_events_captured boolean DEFAULT false;',
    'ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS win_30_70 boolean;',
    'ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS webhook_status text DEFAULT \'pending\';',
    'ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS under25_result text DEFAULT \'pending\';',
    'CREATE INDEX IF NOT EXISTS idx_live_alerts_goal_events_captured ON public.live_alerts(goal_events_captured);'
  ];

  for (const query of queries) {
    console.log(`Executing: ${query}`);
    const { error } = await supabase.rpc('exec_sql', { sql_query: query });
    if (error) {
      // If exec_sql RPC doesn't exist, we might need another way or just report it.
      // Most Supabase projects don't have exec_sql enabled by default for security.
      console.error(`Error executing query: ${error.message}`);
      console.log('Note: If rpc("exec_sql") fails, please apply these manually via the Supabase SQL Editor.');
    } else {
      console.log('Success!');
    }
  }
}

applyFixes();
