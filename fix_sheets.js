import { load } from "https://deno.land/std@0.168.0/dotenv/mod.ts";
const env = await load();

const PENDINGS = ["1505010", "1505394", "1512527"];

async function main() {
    const res = await fetch("https://zswefmaedkdvbzakuzod.supabase.co/rest/v1/live_alerts?select=fixture_id,goal_ht_result,over15_result,goal_events,final_score&fixture_id=in.(" + PENDINGS.join(',') + ")", {
        headers: {
            "apikey": env["VITE_SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": "Bearer " + env["VITE_SUPABASE_PUBLISHABLE_KEY"]
        }
    });
    const data = await res.json();

    // Group by fixture_id
    const grouped = {};
    for (const alert of data) {
        grouped[alert.fixture_id] = alert;
    }

    for (const fId of PENDINGS) {
        const alert = grouped[fId];
        if (!alert) {
            console.log('Skipping', fId);
            continue;
        }

        const goalEvents = alert.goal_events || [];
        const goalsStr = goalEvents.map(e => `${e.minute}${e.extra ? '+' + e.extra : ''}'`).join(', ');

        let finalResult = alert.goal_ht_result.toUpperCase(); // Both green, or picking the right one

        console.log(`Updating ${fId}: ${finalResult} ${goalsStr} ${alert.final_score}`);

        const updateRes = await fetch('https://script.google.com/macros/s/AKfycbzp1ZngBLwh8jwt7TZUGHgohQZSfd-Gpz1-vTISriNzd9YTGINO9ogqB318Vy-9Uqth/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'UPDATE_ALERT',
                fixtureId: fId,
                goalsInterval: goalsStr,
                finalScore: alert.final_score
            })
        });
        console.log(fId, updateRes.status, await updateRes.text());
    }
}
main();
