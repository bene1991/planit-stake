import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const url = "https://zswefmaedkdvbzakuzod.supabase.co/functions/v1/api-football";

async function test() {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ endpoint: 'fixtures?id=1398599' })
    });
    const data = await response.json();
    const fixture = data.response[0];
    console.log("Fixture Details:");
    console.log(`Teams: ${fixture.teams.home.name} vs ${fixture.teams.away.name}`);
    console.log(`Score: ${fixture.goals.home}x${fixture.goals.away}`);
    console.log(`Status: ${fixture.fixture.status.long} (${fixture.fixture.status.short})`);
    console.log("Events:");
    fixture.events.forEach(e => {
        if (e.type === 'Goal') {
            console.log(`- GOAL: ${e.time.elapsed}' ${e.player.name} (${e.team.name}) ${e.detail === 'Penalty' ? '[P]' : ''}`);
        }
    });
}

test();
