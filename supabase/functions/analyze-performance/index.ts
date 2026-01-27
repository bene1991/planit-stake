import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  activeFilters?: {
    methods: string[];
    leagues: string[];
    result: 'all' | 'Green' | 'Red';
  };
  isFiltered?: boolean;
  generalWinRate?: number;
  // New advanced metrics
  advancedMetrics?: {
    maxRunUp: number;
    maxDrawdown: number;
    recoveryRate: number;
    ruinCoefficient: number;
    profitDays: number;
    lossDays: number;
    totalDays: number;
  };
}

interface StructuredAnalysis {
  score: number;
  classification: "Excelente" | "Bom" | "Regular" | "Atenção" | "Crítico";
  summary: string;
  positivePoints: string[];
  negativePoints: string[];
  suggestions: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { performanceData, structuredOutput = false } = await req.json() as { 
      performanceData: PerformanceData;
      structuredOutput?: boolean;
    };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const hasFilters = performanceData.isFiltered;
    const filterMethods = performanceData.activeFilters?.methods || [];
    const filterLeagues = performanceData.activeFilters?.leagues || [];
    const filterResult = performanceData.activeFilters?.result || 'all';
    
    const filterContextDescription = hasFilters
      ? `
CONTEXTO IMPORTANTE - FILTROS ATIVOS:
${filterMethods.length > 0 ? `- Método(s) selecionado(s): ${filterMethods.join(', ')}` : ''}
${filterLeagues.length > 0 ? `- Liga(s) selecionada(s): ${filterLeagues.join(', ')}` : ''}
${filterResult !== 'all' ? `- Resultado filtrado: Apenas ${filterResult === 'Green' ? 'Greens' : 'Reds'}` : ''}
${performanceData.generalWinRate ? `- Win Rate geral (sem filtros): ${performanceData.generalWinRate}%` : ''}

INSTRUÇÃO CRÍTICA: Você está analisando APENAS os dados filtrados acima.`
      : '';

    const advancedMetricsContext = performanceData.advancedMetrics
      ? `
📈 MÉTRICAS AVANÇADAS:
- Run-up Máximo: R$ ${performanceData.advancedMetrics.maxRunUp.toFixed(2)}
- Drawdown Máximo: R$ ${performanceData.advancedMetrics.maxDrawdown.toFixed(2)}
- Taxa de Recuperação: ${performanceData.advancedMetrics.recoveryRate.toFixed(2)}
- Coeficiente de Ruína: ${(performanceData.advancedMetrics.ruinCoefficient * 100).toFixed(1)}%
- Dias Positivos: ${performanceData.advancedMetrics.profitDays}
- Dias Negativos: ${performanceData.advancedMetrics.lossDays}
- Total de Dias: ${performanceData.advancedMetrics.totalDays}`
      : '';

    const systemPrompt = structuredOutput
      ? `Você é um analista especializado em trading esportivo. Analise os dados e retorne uma análise estruturada usando a função analyze_bankroll_health.

REGRAS:
1. Score: 0-100 baseado em Win Rate, Profit, Consistência, Drawdown
2. Classificação: Excelente (80+), Bom (60-79), Regular (40-59), Atenção (20-39), Crítico (0-19)
3. Pontos Positivos: 3-5 aspectos fortes identificados nos dados
4. Pontos Negativos: 3-5 problemas ou riscos identificados
5. Sugestões: 3-5 ações práticas e específicas
6. Resumo: 2-3 frases sobre a saúde geral da banca

Use dados específicos nas análises (cite números). Seja direto e acionável.`
      : `Você é um analista especializado em trading esportivo, especificamente em mercados de futebol como BTTS (Both Teams To Score), Over/Under gols, e operações de Back e Lay em exchanges.

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
10. CRUCIAL: Se há filtros ativos, foque EXCLUSIVAMENTE nos dados filtrados
11. Quando analisar um método específico, compare com o desempenho geral
12. Mencione claramente no início da análise qual contexto está sendo analisado

FORMATO DA RESPOSTA:
- Use markdown com headers (##)
- Máximo 300 palavras
- Se houver filtro de método: "## Análise do Método [NOME]"
- Se houver filtro de liga: "## Análise da Liga [NOME]"
- Senão: "## Resumo Geral"
- Seções: Resumo/Contexto, Pontos Fortes, Pontos de Atenção, Dicas Práticas`;

    const userPrompt = `Analise meu desempenho de trading no período: ${performanceData.period}
${filterContextDescription}

📊 ESTATÍSTICAS ${hasFilters ? '(DADOS FILTRADOS)' : 'GERAIS'}:
- Total de operações: ${performanceData.overallStats.total}
- Greens: ${performanceData.overallStats.greens} | Reds: ${performanceData.overallStats.reds}
- Win Rate: ${performanceData.overallStats.winRate}%
- Lucro total: ${performanceData.profit >= 0 ? '+' : ''}${performanceData.profit} stakes
- Odd média: ${performanceData.averageOdd}
- Breakeven necessário: ${performanceData.breakevenRate}%
- Variação WR vs período anterior: ${performanceData.comparison.winRateChange >= 0 ? '+' : ''}${performanceData.comparison.winRateChange}%
- Variação volume: ${performanceData.comparison.volumeChange >= 0 ? '+' : ''}${performanceData.comparison.volumeChange}%
${advancedMetricsContext}

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

    // Build request body
    const requestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    };

    // Add tool calling for structured output
    if (structuredOutput) {
      requestBody.tools = [{
        type: "function",
        function: {
          name: "analyze_bankroll_health",
          description: "Retorna análise estruturada da saúde da banca",
          parameters: {
            type: "object",
            properties: {
              score: { 
                type: "number", 
                description: "Score de 0 a 100 baseado na análise geral" 
              },
              classification: { 
                type: "string", 
                enum: ["Excelente", "Bom", "Regular", "Atenção", "Crítico"],
                description: "Classificação baseada no score"
              },
              summary: { 
                type: "string", 
                description: "Resumo de 2-3 frases sobre a saúde geral da banca" 
              },
              positivePoints: { 
                type: "array", 
                items: { type: "string" },
                description: "Lista de 3-5 pontos positivos identificados"
              },
              negativePoints: { 
                type: "array", 
                items: { type: "string" },
                description: "Lista de 3-5 pontos negativos ou riscos identificados"
              },
              suggestions: { 
                type: "array", 
                items: { type: "string" },
                description: "Lista de 3-5 sugestões práticas e acionáveis"
              }
            },
            required: ["score", "classification", "summary", "positivePoints", "negativePoints", "suggestions"],
            additionalProperties: false
          }
        }
      }];
      requestBody.tool_choice = { type: "function", function: { name: "analyze_bankroll_health" } };
    } else {
      requestBody.stream = true;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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

    // Handle structured output (non-streaming)
    if (structuredOutput) {
      const data = await response.json();
      
      // Extract the tool call result
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        try {
          const analysis: StructuredAnalysis = JSON.parse(toolCall.function.arguments);
          return new Response(JSON.stringify({ analysis }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (parseError) {
          console.error("Failed to parse tool call arguments:", parseError);
          return new Response(JSON.stringify({ error: "Erro ao processar resposta da IA" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      return new Response(JSON.stringify({ error: "Resposta da IA não contém análise estruturada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return streaming response for non-structured output
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
