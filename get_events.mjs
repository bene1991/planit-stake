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
    console.log("Gols:");
    fixture.events.filter(e => e.type === 'Goal').forEach(e => {
        console.log(`${e.team.name}: ${e.time.elapsed}'`);
    });
}

test();
