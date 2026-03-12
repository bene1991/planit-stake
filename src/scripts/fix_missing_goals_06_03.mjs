import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://zswefmaedkdvbzakuzod.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GCQsP9TJfcm19AIIDSlObw_OIrfwP7T";

const updates = [
    {
        fixture_id: "1384041",
        goal_events: [{ team: "NK Osijek", minute: 61, player: "Nail Omerovic", detail: "Normal Goal" }],
        final_score: "0x1"
    },
    {
        fixture_id: "1388832",
        goal_events: [{ team: "SV Elversberg", minute: 85, player: "Lukasz Poreba", detail: "Normal Goal" }],
        final_score: "1x0"
    },
    {
        fixture_id: "1385992",
        goal_events: [{ team: "Csikszereda", minute: 71, player: "M. Eppel", detail: "Normal Goal" }],
        final_score: "1x0"
    },
    {
        fixture_id: "1521297",
        goal_events: [{ team: "Jamshedpur", minute: 57, player: "Eze", detail: "Normal Goal" }],
        final_score: "1x0"
    },
    {
        fixture_id: "1388838",
        goal_events: [{ team: "FC Schalke 04", minute: 15, player: "Edin Džeko", detail: "Normal Goal" }],
        final_score: "1x0"
    }
];

async function run() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('--- Starting Database Fix (06/03 Data Loss) ---');

    for (const item of updates) {
        console.log(`Processing Fixture ${item.fixture_id}...`);

        // Note: This might fail if RLS is enabled for anon key (which it seems to be)
        const { data, error } = await supabase
            .from('live_alerts')
            .update({
                goal_events: item.goal_events,
                final_score: item.final_score,
                updated_at: new Date().toISOString()
            })
            .eq('fixture_id', item.fixture_id);

        if (error) {
            console.error(`[Error] Failed to update fixture ${item.fixture_id}:`, error.message);
        } else {
            console.log(`[Success] Updated fixture ${item.fixture_id}`);
        }
    }

    console.log('--- Fix Completed ---');
}

run();
