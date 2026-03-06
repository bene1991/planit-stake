import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("Starting backfill for goal_events in live_alerts...");

        const { data: alerts, error } = await supabase
            .from('live_alerts')
            .select('*')
            .eq('goal_events', '[]')
            .or('goal_ht_result.eq.green,over15_result.eq.green,final_score.neq.0x0')
            .not('goal_ht_result', 'eq', 'pending')
            .not('over15_result', 'eq', 'pending');

        if (error) {
            throw new Error(`Error fetching alerts: ${error.message}`);
        }

        if (!alerts || alerts.length === 0) {
            return new Response(JSON.stringify({ message: "No alerts found needing backfill." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

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

                // Sleep 1 second
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.error(`Error processing fixture ${fixtureId}:`, e);
            }
        }

        return new Response(JSON.stringify({
            status: 'ok',
            message: 'Backfill complete.',
            fixturesUpdated: updatedCount
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: Omit<Error, "name"> & { name?: string | undefined; }) {
        console.error('Unhandled error:', error);
        return new Response(JSON.stringify({ error: (error as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
