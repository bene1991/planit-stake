const fs = require('fs');

async function check() {
    const url = 'https://dchpumblhquqgfttbnkq.supabase.co/rest/v1/api_cache?cache_key=eq.fixtures%3Fdate%3D2026-03-01&select=response_data';
    const key = process.env.VITE_SUPABASE_ANON_KEY;

    if (!key) {
        console.error("Please export VITE_SUPABASE_ANON_KEY first.");
        return;
    }

    const response = await fetch(url, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const data = await response.json();

    if (data && data.length > 0) {
        const fixtures = data[0].response_data.response || [];
        const marseilleGames = fixtures.filter(f =>
            f.teams.home.name.toLowerCase().includes('marseille') ||
            f.teams.away.name.toLowerCase().includes('marseille')
        );

        console.log('Marseille games on 2026-03-01 in DB cache:');
        marseilleGames.forEach(f => {
            console.log(`- ${f.teams.home.name} ${f.goals.home} x ${f.goals.away} ${f.teams.away.name} (League: ${f.league.name}, Status: ${f.fixture.status.short}, Date: ${f.fixture.date})`);
        });

        if (marseilleGames.length === 0) {
            console.log("No games found corresponding to Marseille.");
        }
    } else {
        console.log("No cache found for that date.");
    }
}

check();
