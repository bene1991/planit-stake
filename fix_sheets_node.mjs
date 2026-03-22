import fs from 'fs';
import { resolve } from 'path';

const envConfig = fs.readFileSync('.env', 'utf-8')
    .split('\n')
    .filter(line => line.includes('='))
    .reduce((acc, line) => {
        const [key, val] = line.split('=');
        acc[key] = val.replace(/"/g, '').trim();
        return acc;
    }, {});

const PENDINGS = ["1505010", "1505394", "1512527"];

async function main() {
    const res = await fetch("https://zswefmaedkdvbzakuzod.supabase.co/rest/v1/live_alerts?select=fixture_id,goal_ht_result,over15_result,goal_events,final_score&fixture_id=in.(" + PENDINGS.join(',') + ")", {
        headers: {
            "apikey": envConfig["VITE_SUPABASE_PUBLISHABLE_KEY"],
            "Authorization": "Bearer " + envConfig["VITE_SUPABASE_PUBLISHABLE_KEY"]
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

        let finalResult = alert.goal_ht_result.toUpperCase();

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
