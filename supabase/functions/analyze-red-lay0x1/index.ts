import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { analysis_id } = await req.json();
    if (!analysis_id) {
      return new Response(JSON.stringify({ error: 'analysis_id required' }), { status: 400, headers: corsHeaders });
    }

    // Fetch the analysis
    const { data: analysis, error: fetchError } = await supabase
      .from('lay0x1_analyses')
      .select('*')
      .eq('id', analysis_id)
      .eq('owner_id', user.id)
      .single();

    if (fetchError || !analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), { status: 404, headers: corsHeaders });
    }

    // Fetch user's resolved analyses for context
    const { data: allResolved } = await supabase
      .from('lay0x1_analyses')
      .select('league, result, score_value, criteria_snapshot')
      .eq('owner_id', user.id)
      .not('result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    // Calculate league stats
    const leagueStats: Record<string, { total: number; reds: number }> = {};
    for (const r of allResolved || []) {
      if (!leagueStats[r.league]) leagueStats[r.league] = { total: 0, reds: 0 };
      leagueStats[r.league].total++;
      if (r.result === 'Red') leagueStats[r.league].reds++;
    }

    const thisLeague = leagueStats[analysis.league] || { total: 0, reds: 0 };
    const thisLeagueRedRate = thisLeague.total > 0 ? ((thisLeague.reds / thisLeague.total) * 100).toFixed(1) : 'N/A';

    // Fetch current weights
    const { data: weights } = await supabase
      .from('lay0x1_weights')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();

    const criteria = analysis.criteria_snapshot || {};

    const prompt = `Você é um analista especialista em Lay 0x1 (apostar contra o resultado exato 0x1 no futebol).

O jogo abaixo foi APROVADO pelo scanner (todos os critérios passaram), mas o resultado REAL foi 0x1 (Red).

**Jogo:**
- ${analysis.home_team} vs ${analysis.away_team}
- Liga: ${analysis.league}
- Data: ${analysis.date}
- Placar final: ${analysis.final_score_home}-${analysis.final_score_away}
- Score do scanner: ${analysis.score_value}/100

**Critérios no momento da análise:**
- Média gols mandante (casa): ${criteria.home_goals_avg || 'N/A'}
- Média gols sofridos visitante (fora): ${criteria.away_conceded_avg || 'N/A'}
- Over 1.5 combinado: ${criteria.over15_combined || 'N/A'}%
- H2H 0x1 nos últimos 5: ${criteria.h2h_0x1_count ?? 'N/A'}
- Odd casa: ${criteria.home_odd || 'N/A'} | Odd visitante: ${criteria.away_odd || 'N/A'}
- Liga média gols: ${criteria.league_goals_avg || 'N/A'}

**Estatísticas da liga ${analysis.league}:**
- Total de jogos analisados nesta liga: ${thisLeague.total}
- Reds nesta liga: ${thisLeague.reds} (${thisLeagueRedRate}%)

**Pesos atuais do modelo:**
- Ofensivo: ${weights?.offensive_weight || 20} | Defensivo: ${weights?.defensive_weight || 20}
- Over: ${weights?.over_weight || 20} | Liga: ${weights?.league_avg_weight || 15}
- H2H: ${weights?.h2h_weight || 15} | Odds: ${weights?.odds_weight || 10}

**Thresholds atuais:**
- Mín. gols mandante: ${weights?.min_home_goals_avg || 1.5}
- Mín. gols sofridos visitante: ${weights?.min_away_conceded_avg || 1.5}
- Mín. Over 1.5 combinado: ${weights?.min_over15_combined || 70}%
- Máx. H2H 0x1: ${weights?.max_h2h_0x1 || 0}

Analise este Red e responda em formato JSON (sem markdown):
{
  "summary": "Resumo em 1-2 frases do porquê o 0x1 aconteceu",
  "key_factors": ["fator1", "fator2", "fator3"],
  "league_recommendation": "manter" ou "bloquear" ou "monitorar",
  "league_reason": "Motivo da recomendação sobre a liga",
  "threshold_suggestions": [
    {"param": "nome_do_parametro", "current": valor_atual, "suggested": valor_sugerido, "reason": "motivo"}
  ],
  "risk_score": número de 1 a 10 (quão previsível era esse Red),
  "pattern_detected": "Padrão identificado ou null"
}`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), { status: 500, headers: corsHeaders });
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um analista de apostas esportivas especializado em Lay 0x1. Responda APENAS com JSON válido, sem markdown.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), { status: 429, headers: corsHeaders });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required for AI analysis.' }), { status: 402, headers: corsHeaders });
      }
      console.error('AI error:', status, await aiResponse.text());
      return new Response(JSON.stringify({ error: 'AI gateway error' }), { status: 500, headers: corsHeaders });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      // Try to extract JSON from potential markdown wrapping
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
    } catch {
      parsed = { summary: content, key_factors: [], raw: true };
    }

    // Save AI analysis to the record
    const updatedSnapshot = {
      ...criteria,
      ai_red_analysis: parsed,
      red_insights: [
        parsed.summary,
        ...(parsed.key_factors || []),
      ],
    };

    await supabase
      .from('lay0x1_analyses')
      .update({ criteria_snapshot: updatedSnapshot })
      .eq('id', analysis_id)
      .eq('owner_id', user.id);

    return new Response(
      JSON.stringify({ analysis: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in analyze-red-lay0x1:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
