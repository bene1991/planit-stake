import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
    const todayStr = '11/03/2026';
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

    // 1. Enviar o Masr vs Future FC
    const masrPayload = {
        action: 'NEW_ALERT',
        date: todayStr,
        match: 'ZED FC vs Future FC',
        league: 'Premier League',
        method: '2 Ch Alvo + Posse 60% - Free Fire, Chute 4/2 - Free Fire 30 ao 70',
        alertMinute: '25',
        fixtureId: 1391515
    };
    
    // 2. Enviar o Middlesbrough vs Charlton (se vc passou, so testando)
    const midPayload = {
      action: 'NEW_ALERT',
      date: todayStr,
      match: 'Middlesbrough vs Charlton',
      league: 'Championship',
      method: 'Pose 70% Free Fire 30 a 70',
      alertMinute: '15',
      fixtureId: 1410185
    };

    console.log("Enviando Masr...");
    try { 
      let r1 = await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(masrPayload), headers: { 'Content-Type': 'application/json' }});
      console.log(await r1.text()); 
    } catch(e) { console.log(e) }
    
    console.log("Enviando Middlesbrough...");
    try { 
      let r2 = await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(midPayload), headers: { 'Content-Type': 'application/json' }});
      console.log(await r2.text()); 
    } catch(e) { console.log(e) }
}
run();
