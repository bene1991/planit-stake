const { createClient } = require("@supabase/supabase-js");
const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = createClient(url, key);

async function m() {
  const {data} = await client.from("live_alerts").select().gt("created_at", new Date(Date.now() - 48*60*60*1000).toISOString());
  console.log(data.length);
  for(const r of data) {
    const h = r.home_team;
    const a = r.away_team;
    try {
      const res = await fetch(`https://api.telegram.org/bot8715635573:AAFTwdEYLnfp5Ncbme73QaKzjlFvY28LWuM/sendMessage`, {
         method:"POST", headers:{"content-type":"application/json"},
         body: JSON.stringify({chat_id: "-1003715464150", parse_mode: "HTML", text:`🤖 <b>ROBÔ: SINAL (REPLAY)</b>\n\n⚽ ${h} x ${a}\n⏰ ${r.minute_at_alert}\n🔥 ${r.variation_name}`})
      })
      if(r.goal_ht_result==='green' || r.goal_ht_result==='red') {
         await fetch(`https://api.telegram.org/bot8715635573:AAFTwdEYLnfp5Ncbme73QaKzjlFvY28LWuM/sendMessage`, {
             method:"POST", headers:{"content-type":"application/json"},
             body: JSON.stringify({chat_id: "-1003715464150", parse_mode: "HTML", text:`${r.goal_ht_result==='green'?'✅':'❌'} <b>ROBÔ: ${r.goal_ht_result.toUpperCase()} (REPLAY)!</b>\n\n⚽ ${h} x ${a}\n📊 Mercado: Gol HT\n🎯 ${r.variation_name}`})
         })
      }
      if(r.over15_result==='green' || r.over15_result==='red') {
         await fetch(`https://api.telegram.org/bot8715635573:AAFTwdEYLnfp5Ncbme73QaKzjlFvY28LWuM/sendMessage`, {
             method:"POST", headers:{"content-type":"application/json"},
             body: JSON.stringify({chat_id: "-1003715464150", parse_mode: "HTML", text:`${r.over15_result==='green'?'✅':'❌'} <b>ROBÔ: ${r.over15_result.toUpperCase()} (REPLAY)!</b>\n\n⚽ ${h} x ${a}\n📊 Mercado: Over 1.5\n🎯 ${r.variation_name}`})
         })
      }
    }catch(e){}
    await new Promise(res=>setTimeout(res,300));
  }
  console.log("Feito!");
}
m();
