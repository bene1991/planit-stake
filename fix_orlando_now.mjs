import fetch from "node-fetch";

async function run() {
    const webhookUrl = 'https://script.google.com/macros/s/AKfycbw9s_3Y5-qXTo_8p7S-F6lH-t1-h8p-q-P-s-s-R-r-T-E-L/exec';

    console.log("Enviando webhook pro Orlando...");
    try { 
      let r1 = await fetch(webhookUrl, { 
        method: 'POST', 
        body: JSON.stringify({
            action: 'UPDATE_ALERT',
            fixtureId: 1429586,
            alertMinute: 15,
            finalScore: "3x0",
            goalMinutes: "27', 72', 88'",
            result: "RED"
        }), 
        headers: { 'Content-Type': 'application/json' }
      });
      console.log("Res:", r1.status, await r1.text()); 
    } catch(e) { console.log("Erro:", e) }
    
    console.log("Enviando pro Masr... RED sem goals");
    try { 
      let r2 = await fetch(webhookUrl, { 
        method: 'POST', 
        body: JSON.stringify({
            action: 'UPDATE_ALERT',
            fixtureId: 1418897,
            alertMinute: 25,
            finalScore: "0x0",
            goalMinutes: "-",
            result: "RED"
        }), 
        headers: { 'Content-Type': 'application/json' }
      });
      console.log("Res:", r2.status, await r2.text()); 
    } catch(e) { console.log("Erro:", e) }

    console.log("Enviando pro Middlesbrough... GREEN 41");
    try { 
      let r3 = await fetch(webhookUrl, { 
        method: 'POST', 
        body: JSON.stringify({
            action: 'UPDATE_ALERT',
            fixtureId: 1410185,
            alertMinute: 15,
            finalScore: "2x1",
            goalMinutes: "23', 41', 77'",
            result: "GREEN"
        }), 
        headers: { 'Content-Type': 'application/json' }
      });
      console.log("Res:", r3.status, await r3.text()); 
    } catch(e) { console.log("Erro:", e) }
    
    console.log("Feito!");
}
run();
