import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function fetchFromApi(fixtureId) {
    const url = `${supabaseUrl}/functions/v1/api-football`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'apikey': apiKey
        },
        body: JSON.stringify({
            endpoint: 'fixtures',
            params: { id: fixtureId, ignoreCache: true }
        })
    });
    const data = await response.json();
    return data.response?.[0];
}

async function restore() {
    // Last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.log(`Checking for misresolved alerts since ${since}...`);

    const { data: alerts, error } = await supabase
        .from('live_alerts')
        .select('*')
        .gte('created_at', since)
        .neq('final_score', 'pending')
        .not('final_score', 'is', null);

    if (error) { console.error(error); return; }

    console.log(`Found ${alerts.length} resolved alerts to check.`);

    let fixedCount = 0;

    for (const a of alerts) {
        process.stdout.write(`Reviewing alert ${a.id} (fixture ${a.fixture_id})... `);
        const fixture = await fetchFromApi(a.fixture_id);
        if (!fixture) { console.log("No data"); continue; }

        const apiScore = `${fixture.goals.home}x${fixture.goals.away}`;
        const dbScore = a.final_score;

        if (apiScore !== dbScore) {
            console.log(`SCORE MISMATCH! DB: ${dbScore}, API: ${apiScore}. Restoring to pending...`);
            await supabase.from('live_alerts').update({
                goal_ht_result: 'pending',
                over15_result: 'pending',
                final_score: 'pending',
                updated_at: new Date().toISOString()
            }).eq('id', a.id);
            fixedCount++;
        } else {
            // Also check if status was RED when it should have been GREEN (for HT specifically)
            const events = fixture.events || [];
            const hasHtGoal = events.some(e => e.type === 'Goal' && e.time.elapsed >= 30 && e.time.elapsed <= 45); // Simplified HT check
            
            if (a.goal_ht_result === 'red' && hasHtGoal) {
                console.log(`HT RED MISMATCH! DB has RED, but API has goals in 30-45. Restoring...`);
                await supabase.from('live_alerts').update({
                    goal_ht_result: 'pending',
                    over15_result: 'pending',
                    final_score: 'pending',
                    updated_at: new Date().toISOString()
                }).eq('id', a.id);
                fixedCount++;
            } else {
                console.log(`OK.`);
            }
        }
    }
    console.log(`\nFixed ${fixedCount} alerts.`);
}

restore();
