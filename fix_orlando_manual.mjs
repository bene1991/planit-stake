import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

async function run() {
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

    console.log("Resolvendo Orlando...");
    try { 
      let r1 = await fetch(webhookUrl, { 
        method: 'POST', 
        body: JSON.stringify({
            action: 'UPDATE_ALERT',
            fixtureId: 1410166,
            alertMinute: 15,
            finalScore: "3x0",
            goalMinutes: "27', 72', 88'"
        }), 
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(await r1.text()); 
    } catch(e) { console.log(e) }
}
run();
