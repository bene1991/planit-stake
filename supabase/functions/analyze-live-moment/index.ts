import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { homeTeam, awayTeam, minute, homeScore, awayScore, homeLdi, awayLdi, homeTrend, awayTrend, possession, shotsOnHome, shotsOnAway, corners } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    console.log(`[analyze-live-moment] ${homeTeam} vs ${awayTeam} - ${minute}'`);

    const systemPrompt = `Você é um analista de futebol conciso. Gere UMA frase de no máximo 120 caracteres descrevendo o MOMENTO ATUAL do jogo baseado nas estatísticas.

REGRAS OBRIGATÓRIAS:
- Máximo 120 caracteres
- Linguagem clara e objetiva em português
- NUNCA prever gols ou resultados
- NUNCA recomendar entradas ou apostas
- Apenas explicar quem está melhor agora e por quê
- Use dados concretos quando disponíveis (posse, finalizações)
- Se equilibrado, diga que está equilibrado`;

    const statsContext = `Jogo: ${homeTeam} ${homeScore}-${awayScore} ${awayTeam} (${minute}')
LDI Casa: ${homeLdi} (tendência: ${homeTrend}) | LDI Visitante: ${awayLdi} (tendência: ${awayTrend})
Posse: ${possession || 'N/A'}% casa
Finalizações no gol: Casa ${shotsOnHome ?? '?'} vs Visitante ${shotsOnAway ?? '?'}
Escanteios: ${corners || 'N/A'}`;

    const aiBody = JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { role: "user", parts: [{ text: statsContext }] }
      ]
    });

    let response: Response | null = null;
    let responseText = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: aiBody,
        });
        responseText = await response.text();
        if (response.ok) break;
        console.warn(`[analyze-live-moment] Attempt ${attempt + 1} failed: ${response.status}`);
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      } catch (fetchErr) {
        console.warn(`[analyze-live-moment] Fetch attempt ${attempt + 1} error:`, fetchErr);
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!response || !response.ok) {
      const status = response?.status || 500;
      console.error("[analyze-live-moment] AI error:", status, responseText.substring(0, 200));
      // Return 200 with null text so client doesn't break
      return new Response(JSON.stringify({ error: "AI temporarily unavailable", text: null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[analyze-live-moment] Non-JSON response:", responseText.substring(0, 200));
      return new Response(JSON.stringify({ error: "Invalid AI response", text: null }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

    // Enforce 120 char limit
    if (text && text.length > 120) {
      text = text.slice(0, 117) + '...';
    }

    console.log(`[analyze-live-moment] Result: "${text}"`);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-live-moment] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", text: null }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
