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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: statsContext },
        ],
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited", text: null }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required", text: null }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("[analyze-live-moment] AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error", text: null }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content?.trim() || null;

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
