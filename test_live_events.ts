import { createClient } from "npm:@supabase/supabase-js@2";
import * as dotenv from "npm:dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.functions.invoke('api-football', {
        body: {
            endpoint: 'fixtures',
            params: { live: 'all' }
        }
    });

    if (error) {
        console.error("Error fetching:", error);
        return;
    }

    const fixtures = data?.response || [];
    console.log("Found", fixtures.length, "live fixtures");

    if (fixtures.length > 0) {
        const withEvents = fixtures.filter((f: any) => f.events && f.events.length > 0);
        console.log(`Fixtures with events: ${withEvents.length}`);
        if (withEvents.length > 0) {
            console.log("Example events from first fixture:", withEvents[0].events.slice(0, 2));
        } else {
            console.log("No live fixtures contain an 'events' array directly.");
        }
    }
}

main();
