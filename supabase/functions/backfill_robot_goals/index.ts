import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import "https://deno.land/x/dotenv@v3.2.0/load.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    Deno.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function callApiFootball(endpoint: string) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/api-football`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ endpoint }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function runBackfill() {
    console.log("Starting backfill for goal_events in live_alerts...");

    // Find all alerts that are resolved (not pending) but have no goal_events
    // We only care about games where total goals > 0, but to be safe we can check all resolved games or games with green results
    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('*')
        .eq('goal_events', '[]')
        .or('goal_ht_result.eq.green,over15_result.eq.green,final_score.neq.0x0')
        .not('goal_ht_result', 'eq', 'pending')
        .not('over15_result', 'eq', 'pending');

    if (error) {
        console.error("Error fetching alerts:", error);
        return;
    }

    if (!alerts || alerts.length === 0) {
        console.log("No alerts found needing backfill.");
        return;
    }

    console.log(`Found ${alerts.length} alerts to backfill. (These might share fixture IDs)`);

    // Get unique fixture IDs to minimize API calls
    const uniqueFixtureIds = [...new Set(alerts.map(a => a.fixture_id))];
    console.log(`Unique fixtures to fetch: ${uniqueFixtureIds.length}`);

    let updatedCount = 0;

    for (let i = 0; i < uniqueFixtureIds.length; i++) {
        const fixtureId = uniqueFixtureIds[i];
        console.log(`Processing fixture ${fixtureId} (${i + 1}/${uniqueFixtureIds.length})...`);

        try {
            const data = await callApiFootball(`fixtures?id=${fixtureId}`);
            const fixtureObj = data?.response?.[0];

            if (!fixtureObj || !fixtureObj.events) {
                console.log(`No events found for fixture ${fixtureId}`);
                continue;
            }

            const totalGoals = (fixtureObj.goals.home || 0) + (fixtureObj.goals.away || 0);

            if (totalGoals > 0) {
                const goalEvents = fixtureObj.events
                    .filter((e: any) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
                    .map((e: any) => ({
                        minute: e.time.elapsed,
                        team: e.team?.name,
                        player: e.player?.name,
                        detail: e.detail
                    }));

                if (goalEvents.length > 0) {
                    const { error: updateErr } = await supabase
                        .from('live_alerts')
                        .update({ goal_events: goalEvents })
                        .eq('fixture_id', fixtureId);

                    if (updateErr) {
                        console.error(`Error updating fixture ${fixtureId}:`, updateErr);
                    } else {
                        updatedCount++;
                        console.log(`Successfully updated fixture ${fixtureId} with ${goalEvents.length} goals.`);
                    }
                }
            }

            // Wait 1 second between requests to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (e) {
            console.error(`Error processing fixture ${fixtureId}:`, e);
        }
    }

    console.log(`Backfill complete. Updated ${updatedCount} unique fixtures.`);
}

runBackfill();
