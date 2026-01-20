import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PerformanceData {
  period: string;
  overallStats: {
    total: number;
    greens: number;
    reds: number;
    winRate: number;
  };
  profit: number;
  averageOdd: number;
  breakevenRate: number;
  methodStats: Array<{
    methodName: string;
    total: number;
    greens: number;
    reds: number;
    winRate: number;
  }>;
  topLeagues: Array<{
    league: string;
    winRate: number;
    profit: number;
    total: number;
  }>;
  bottomLeagues: Array<{
    league: string;
    winRate: number;
    profit: number;
    total: number;
  }>;
  topTeams: Array<{
    team: string;
    winRate: number;
    profit: number;
    operations: number;
  }>;
  bottomTeams: Array<{
    team: string;
    winRate: number;
    profit: number;
    operations: number;
  }>;
  oddRangeStats: Array<{
    range: string;
    winRate: number;
    profit: number;
    total: number;
  }>;
  comparison: {
    winRateChange: number;
    volumeChange: number;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { performanceData } = await req.json() as { performanceData: PerformanceData };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um analista especializado em trading esportivo, especificamente em mercados de futebol como BTTS (Both Teams To Score), Over/Under gols, e operações de Back e Lay em exchanges.

Sua função é analisar os dados de desempenho do trader e fornecer insights acionáveis, identificando padrões, pontos fortes, fraquezas e oportunidades de melhoria.

REGRAS IMPORTANTES:
1. Seja direto e objetivo - máximo 4-5 pontos principais
2. Use dados específicos nas suas análises (cite números)
3. Identifique padrões claros (ligas/times lucrativas vs problemáticas)
4. Dê sugestões práticas e acionáveis
5. Use emojis para destacar pontos importantes
6. Considere a relação Win Rate vs Breakeven Rate
7. Analise a qualidade das odds selecionadas
8. Seja encorajador quando houver bons resultados
9. Seja honesto sobre problemas, mas construtivo

FORMATO DA RESPOSTA:
- Use markdown com headers (##)
- Máximo 300 palavras
- Seções: Resumo, Pontos Fortes, Pontos de Atenção, Dicas Práticas`;

    const userPrompt = `Analise meu desempenho de trading no período: ${performanceData.period}

📊 ESTATÍSTICAS GERAIS:
- Total de operações: ${performanceData.overallStats.total}
- Greens: ${performanceData.overallStats.greens} | Reds: ${performanceData.overallStats.reds}
- Win Rate: ${performanceData.overallStats.winRate}%
- Lucro total: ${performanceData.profit >= 0 ? '+' : ''}${performanceData.profit} stakes
- Odd média: ${performanceData.averageOdd}
- Breakeven necessário: ${performanceData.breakevenRate}%
- Variação WR vs período anterior: ${performanceData.comparison.winRateChange >= 0 ? '+' : ''}${performanceData.comparison.winRateChange}%
- Variação volume: ${performanceData.comparison.volumeChange >= 0 ? '+' : ''}${performanceData.comparison.volumeChange}%

📈 PERFORMANCE POR MÉTODO:
${performanceData.methodStats.map(m => `- ${m.methodName}: ${m.winRate}% WR (${m.total} ops, ${m.greens}G/${m.reds}R)`).join('\n')}

🏆 TOP 3 LIGAS (por WR):
${performanceData.topLeagues.map(l => `- ${l.league}: ${l.winRate}% WR, ${l.profit >= 0 ? '+' : ''}${l.profit} stakes (${l.total} ops)`).join('\n')}

⚠️ BOTTOM 3 LIGAS:
${performanceData.bottomLeagues.map(l => `- ${l.league}: ${l.winRate}% WR, ${l.profit >= 0 ? '+' : ''}${l.profit} stakes (${l.total} ops)`).join('\n')}

⚽ TIMES COM MELHOR PERFORMANCE:
${performanceData.topTeams.map(t => `- ${t.team}: ${t.winRate}% WR, ${t.profit >= 0 ? '+' : ''}${t.profit} stakes (${t.operations} ops)`).join('\n')}

❌ TIMES PROBLEMÁTICOS:
${performanceData.bottomTeams.map(t => `- ${t.team}: ${t.winRate}% WR, ${t.profit >= 0 ? '+' : ''}${t.profit} stakes (${t.operations} ops)`).join('\n')}

📉 PERFORMANCE POR FAIXA DE ODD:
${performanceData.oddRangeStats.map(o => `- ${o.range}: ${o.winRate}% WR, ${o.profit >= 0 ? '+' : ''}${o.profit} stakes (${o.total} ops)`).join('\n')}

Por favor, analise esses dados e me dê insights práticos para melhorar meu desempenho.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione mais créditos na sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao conectar com a IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("analyze-performance error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
