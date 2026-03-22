import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const apiKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function debugFixture(fixtureId) {
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
    const fixture = data.response?.[0];
    if (!fixture) {
        console.log("No fixture found");
        return;
    }
    console.log("Score:", fixture.goals);
    console.log("Events count:", fixture.events?.length || 0);
    if (fixture.events) {
        console.log("Goal Events:", fixture.events.filter(e => e.type === 'Goal'));
    }
}

debugFixture('1394655');
