import { createClient } from "npm:@supabase/supabase-js@2";
import * as dotenv from "npm:dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('fixture_cache')
    .select('fixture_id, key_events, status')
    .limit(10)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error("Error fetching:", error);
    return;
  }

  console.log("Found", data?.length, "records");
  for (const row of data || []) {
    console.log(`Fixture ${row.fixture_id} (${row.status}):`);
    const goals = row.key_events?.filter((e: any) => e.type === 'goal') || [];
    console.log(`  Goals: ${goals.length}`, goals);
  }
}

main();
