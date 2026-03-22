const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectFailedMatches() {
    const fixtureIds = [1379270, 1492651, 1531624, 1492653];
    const { data, error } = await supabase
        .from('live_alerts')
        .select('*')
        .in('fixture_id', fixtureIds);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Failing Matches Data:');
    data.forEach(m => {
        console.log(`- ${m.home_team} vs ${m.away_team} (ID: ${m.fixture_id}): Win30/70: ${m.win_30_70}, Score: ${m.final_score}, Goals: ${JSON.stringify(m.goal_events)}`);
    });
}

inspectFailedMatches();
