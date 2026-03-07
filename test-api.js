require('dotenv').config({path: '.env'});
const fetch = require('node-fetch');

async function check() {
  const f = await fetch('https://v3.football.api-sports.io/fixtures?id=1255523', { // a sample dummy or live match
    headers: { 'x-apisports-key': process.env.VITE_API_FOOTBALL_KEY }
  }).then(r => r.json());
  console.log(JSON.stringify(f.response[0]?.goals, null, 2));
  console.log(JSON.stringify(f.response[0]?.score, null, 2));
}
check();
