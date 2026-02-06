import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MethodData {
  methodId: string;
  methodName: string;
  phase: string;
  scores: {
    confidence: number;
    risk: number;
    edge: number;
  };
  alerts: Array<{ type: string; title: string; message: string }>;
  stats: {
    totalOperations: number;
    greens: number;
    reds: number;
    winRate: number;
    profitReais: number;
    profitStakes: number;
    roi: number;
    avgOdd: number;
    maxDrawdown: number;
    currentStreak: { type: string; count: number };
    activeDays: number;
  };
  evolutionByBlocks: Array<{
    block: number;
    operations: number;
    winRate: number;
    profit: number;
  }>;
  contextAnalysis: {
    byLeague: Array<{ league: string; operations: number; winRate: number; profit: number }>;
    byOddRange: Array<{ range: string; operations: number; winRate: number; profit: number }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { methodData } = await req.json() as { methodData: MethodData };
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const breakevenRate = methodData.stats.avgOdd > 1 
      ? (1 / methodData.stats.avgOdd) * 100 
      : 50;

    const systemPrompt = `Você é um analista especializado em trading esportivo. Sua tarefa é analisar os dados de um método de trading e fornecer UMA recomendação clara.

AÇÕES POSSÍVEIS (escolha APENAS UMA):
- "Continuar": Método saudável, continue operando normalmente
- "Pausar": Momento de cautela, pausar temporariamente para reavaliação
- "Ajustar": Necessário ajustar critérios (odds, ligas, mercados)
- "Encerrar": Método não viável, considerar encerramento

CRITÉRIOS DE ANÁLISE:
1. Fase do método (Em Validação, Sinal Fraco, Validado, Reprovado)
2. Edge Score (positivo = vantagem, negativo = desvantagem)
3. Win Rate vs Breakeven necessário
4. Tendência de evolução (últimos blocos)
5. Consistência entre ligas/faixas de odds
6. Nível de risco (drawdown, volatilidade)

REGRAS IMPORTANTES:
- Métodos com menos de 20 operações: sempre recomendar "Continuar" para coletar dados
- Edge negativo consistente após 50+ operações: considerar "Pausar" ou "Encerrar"
- Sequência de 5+ reds: considerar "Pausar"
- Drawdown acima de 5 stakes: alertar sobre risco

Retorne usando a função provide_recommendation.`;

    // Build validations section for prompt
    const validations = (methodData as any).validations;
    let validationsPrompt = '';
    if (validations) {
      validationsPrompt = `
🔬 VALIDAÇÕES AVANÇADAS:
- Robustez: ${validations.robustness.label} (desvio padrão ${validations.robustness.stdDev.toFixed(1)}% entre ${validations.robustness.contextCount} contextos)
- Estabilidade: ${validations.stability.label} (WR recente ${validations.stability.recentWinRate.toFixed(1)}% vs histórico, delta ${validations.stability.deltaWinRate >= 0 ? '+' : ''}${validations.stability.deltaWinRate.toFixed(1)}pp)
- Variância: ${validations.variance.label} (top 10% das ops = ${validations.variance.topPercentContribution.toFixed(0)}% do lucro)
`;
    }

    const userPrompt = `Analise o método "${methodData.methodName}":

📊 CLASSIFICAÇÃO ATUAL: ${methodData.phase}

📈 SCORES:
- Confiança: ${methodData.scores.confidence}/100
- Risco: ${methodData.scores.risk}/100
- Edge: ${methodData.scores.edge} (${methodData.scores.edge > 0 ? 'positivo' : 'negativo'})

📉 ESTATÍSTICAS:
- Operações: ${methodData.stats.totalOperations}
- Win Rate: ${methodData.stats.winRate.toFixed(1)}%
- Breakeven necessário: ${breakevenRate.toFixed(1)}%
- ROI: ${methodData.stats.roi.toFixed(1)}%
- Lucro: ${methodData.stats.profitStakes >= 0 ? '+' : ''}${methodData.stats.profitStakes.toFixed(1)} stakes
- Odd média: ${methodData.stats.avgOdd.toFixed(2)}
- Drawdown máximo: ${methodData.stats.maxDrawdown.toFixed(1)} stakes
- Dias ativos: ${methodData.stats.activeDays}
- Sequência atual: ${methodData.stats.currentStreak.count} ${methodData.stats.currentStreak.type}s

${methodData.evolutionByBlocks.length > 0 ? `
📊 EVOLUÇÃO (últimos blocos de 10 operações):
${methodData.evolutionByBlocks.slice(-3).map(b => `- Bloco ${b.block}: WR ${b.winRate.toFixed(1)}%, Lucro ${b.profit >= 0 ? '+' : ''}${b.profit.toFixed(1)}st`).join('\n')}
` : ''}

${methodData.contextAnalysis.byLeague.length > 0 ? `
🏆 TOP LIGAS:
${methodData.contextAnalysis.byLeague.slice(0, 3).map(l => `- ${l.league}: ${l.winRate.toFixed(1)}% WR (${l.operations} ops)`).join('\n')}
` : ''}

${methodData.contextAnalysis.byOddRange.length > 0 ? `
🎯 PERFORMANCE POR FAIXA DE ODD:
${methodData.contextAnalysis.byOddRange.map(o => `- ${o.range}: ${o.winRate.toFixed(1)}% WR (${o.operations} ops)`).join('\n')}
` : ''}

${methodData.alerts.length > 0 ? `
⚠️ ALERTAS ATIVOS:
${methodData.alerts.map(a => `- [${a.type.toUpperCase()}] ${a.title}: ${a.message}`).join('\n')}
` : ''}
${validationsPrompt}
Com base nesses dados, qual a sua recomendação?`;

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
        tools: [{
          type: "function",
          function: {
            name: "provide_recommendation",
            description: "Fornece a recomendação final para o método de trading",
            parameters: {
              type: "object",
              properties: {
                action: { 
                  type: "string", 
                  enum: ["Continuar", "Pausar", "Ajustar", "Encerrar"],
                  description: "A ação recomendada para o método" 
                },
                explanation: { 
                  type: "string", 
                  description: "Explicação curta e objetiva (máximo 3 frases) do motivo da recomendação" 
                }
              },
              required: ["action", "explanation"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "provide_recommendation" } }
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

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      try {
        const recommendation = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({ recommendation }), {
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
    
    return new Response(JSON.stringify({ error: "Resposta da IA não contém recomendação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("analyze-method error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
