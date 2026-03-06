import fetch from "node-fetch";

async function run() {
    console.log("Acionando a Edge Function live-alerts-resolver...");
    try {
      const res = await fetch(`https://zswefmaedkdvbzakuzod.supabase.co/functions/v1/live-alerts-resolver`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.text();
      console.log("Resposta do Resolver:", data);
    } catch(e) {
      console.error(e);
    }
}
run();
