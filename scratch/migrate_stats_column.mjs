import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Adding stats_at_alert column to live_alerts...');

  const query = 'ALTER TABLE public.live_alerts ADD COLUMN IF NOT EXISTS stats_at_alert jsonb DEFAULT \'{}\'::jsonb;';

  console.log(`Executing: ${query}`);
  const { error } = await supabase.rpc('exec_sql', { sql_query: query });
  
  if (error) {
    console.error(`Error executing query: ${error.message}`);
    console.log('Please apply mortality manually via the Supabase SQL Editor:');
    console.log(query);
  } else {
    console.log('Success! Column stats_at_alert added.');
  }
}

applyMigration();
