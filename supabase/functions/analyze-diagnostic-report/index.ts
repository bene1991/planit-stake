import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DiagnosticInput {
    tab: "lay0x1" | "lay1x0" | "robo";
    metrics: {
        total: number;
        greens: number;
        reds: number;
        winRate: number;
        profit: number;
        avgOdd: number;
    };
    redAnalysis: Array<{
        game: string;
        league: string;
        score: string;
        criteria: Record<string, any>;
        date: string;
    }>;
    leagueBreakdown: Array<{
        name: string;
        total: number;
        greens: number;
        reds: number;
        winRate: number;
        profit: number;
    }>;
    paramSnapshot: Record<string, any>;
    oddRangeStats: Array<{
        range: string;
        total: number;
        greens: number;
        reds: number;
        winRate: number;
        profit: number;
    }>;
    recentTrend: Array<{
        date: string;
        greens: number;
        reds: number;
        profit: number;
    }>;
    // Robo-specific
    variationName?: string;
    methodBreakdown?: {
        ht: { greens: number; reds: number; profit: number; roi: number };
        o15: { greens: number; reds: number; profit: number; roi: number };
    };
}

const TAB_LABELS: Record<string, string> = {
    lay0x1: "Lay 0x1",
    lay1x0: "Lay 1x0",
    robo: "Robô Ao Vivo",
};

function buildSystemPrompt(tab: string): string {
    const tabLabel = TAB_LABELS[tab] || tab;

    const tabSpecific: Record<string, string> = {
        lay0x1: `
Contexto Lay 0x1: Aposta CONTRA o placar exato 0x1. Green = jogo NÃO terminou 0x1. Red = jogo terminou 0x1.
Parâmetros chave: min_home_goals_avg, min_away_conceded_avg, max_away_odd, min_over15_combined, max_h2h_0x1.
Quando analisar reds, foque em: visitante muito defensivo, mandante com baixa média de gols em casa, ligas de poucos gols.`,

        lay1x0: `
Contexto Lay 1x0: Aposta CONTRA o placar exato 1x0. Green = jogo NÃO terminou 1x0. Red = jogo terminou 1x0.
Parâmetros chave: min_away_goals_avg, min_home_conceded_avg, max_home_odd, min_over15_combined, max_h2h_1x0.
Quando analisar reds, foque em: casa que marca pouco mas segura resultado, visitante sem poder ofensivo suficiente.`,

        robo: `
Contexto Robô Ao Vivo: Sistema de detecção de pressão ofensiva in-game. Dois métodos: Gol HT (odd ~2.0) e Over 1.5 (odd ~1.6).
Analise separadamente os métodos HT e O1.5. Considere que variações com ligas fracas podem ter padrões diferentes.
Quando analisar reds, foque em: pressão sem efetividade (xG alto sem gol, muitos escanteios sem finalização perigosa), minuto da entrada (tardio = menos tempo).`,
    };

    return `Você é um analista de apostas esportivas especializado em ${tabLabel}. Seu objetivo é fornecer diagnósticos acionáveis para que o trader possa ajustar seus métodos e melhorar resultados.

${tabSpecific[tab] || ""}

REGRAS OBRIGATÓRIAS:
1. LUCRO em unidades/stakes é a métrica MAIS importante — não apenas win rate
2. Analise os Reds com profundidade: identifique PADRÕES recorrentes (ligas, faixas de odds, critérios)
3. Classifique ligas como FORTE (manter), FRACA (bloquear ou monitorar), ou DADOS INSUFICIENTES
4. Compare TODOS os parâmetros atuais com os dados reais e sugira ajustes ESPECÍFICOS para TODOS eles, sem deixar nenhum de fora
5. Considere volume amostral: <20 operações = dados insuficientes para grandes conclusões
6. Tendência recente importa: se houver sequência de reds recente, destaque isso
7. Seja DIRETO e PRÁTICO — o trader quer AÇÕES, não teoria

Use a função analyze_diagnostic para retornar sua análise.`;
}

function buildUserPrompt(input: DiagnosticInput): string {
    const { metrics, redAnalysis, leagueBreakdown, oddRangeStats, recentTrend, paramSnapshot, methodBreakdown, variationName } = input;

    let prompt = `📊 DADOS PARA DIAGNÓSTICO:\n\n`;

    if (variationName) {
        prompt += `🤖 Variação: ${variationName}\n\n`;
    }

    // Overall metrics
    prompt += `📈 MÉTRICAS GERAIS:\n`;
    prompt += `- Total operações: ${metrics.total}\n`;
    prompt += `- Greens: ${metrics.greens} | Reds: ${metrics.reds}\n`;
    prompt += `- Win Rate: ${metrics.winRate.toFixed(1)}%\n`;
    prompt += `- Lucro: ${metrics.profit >= 0 ? '+' : ''}${metrics.profit.toFixed(2)} stakes\n`;
    prompt += `- Odd média: ${metrics.avgOdd.toFixed(2)}\n\n`;

    // Method breakdown for robo
    if (methodBreakdown) {
        prompt += `🎯 POR MÉTODO:\n`;
        prompt += `- HT: ${methodBreakdown.ht.greens}G/${methodBreakdown.ht.reds}R, Lucro: ${methodBreakdown.ht.profit >= 0 ? '+' : ''}${methodBreakdown.ht.profit.toFixed(2)}u, ROI: ${methodBreakdown.ht.roi.toFixed(1)}%\n`;
        prompt += `- O1.5: ${methodBreakdown.o15.greens}G/${methodBreakdown.o15.reds}R, Lucro: ${methodBreakdown.o15.profit >= 0 ? '+' : ''}${methodBreakdown.o15.profit.toFixed(2)}u, ROI: ${methodBreakdown.o15.roi.toFixed(1)}%\n\n`;
    }

    // Red analysis
    if (redAnalysis.length > 0) {
        prompt += `🔴 DETALHES DOS REDS (${redAnalysis.length} total):\n`;
        const redsToShow = redAnalysis.slice(0, 15);
        for (const r of redsToShow) {
            prompt += `- ${r.game} | Liga: ${r.league} | Placar: ${r.score} | Data: ${r.date}\n`;
            if (r.criteria && Object.keys(r.criteria).length > 0) {
                const criteriaStr = Object.entries(r.criteria)
                    .filter(([k]) => !['criteria_met'].includes(k))
                    .map(([k, v]) => `${k}: ${typeof v === 'number' ? (v as number).toFixed(2) : v}`)
                    .join(', ');
                prompt += `  Critérios: ${criteriaStr}\n`;
            }
        }
        if (redAnalysis.length > 15) {
            prompt += `  ... e mais ${redAnalysis.length - 15} reds\n`;
        }
        prompt += `\n`;
    }

    // League breakdown
    if (leagueBreakdown.length > 0) {
        prompt += `🏟️ LIGAS (${leagueBreakdown.length} total):\n`;
        const sorted = [...leagueBreakdown].sort((a, b) => b.total - a.total).slice(0, 20);
        for (const l of sorted) {
            const wr = l.total > 0 ? ((l.greens / l.total) * 100).toFixed(0) : 'N/A';
            prompt += `- ${l.name}: ${l.total} ops, ${l.greens}G/${l.reds}R (${wr}% WR), ${l.profit >= 0 ? '+' : ''}${l.profit.toFixed(2)} stakes\n`;
        }
        prompt += `\n`;
    }

    // Odd ranges
    if (oddRangeStats.length > 0) {
        prompt += `📉 FAIXAS DE ODD:\n`;
        for (const o of oddRangeStats) {
            prompt += `- ${o.range}: ${o.total} ops, ${o.greens}G/${o.reds}R (${o.winRate.toFixed(0)}% WR), ${o.profit >= 0 ? '+' : ''}${o.profit.toFixed(2)} stakes\n`;
        }
        prompt += `\n`;
    }

    // Recent trend
    if (recentTrend.length > 0) {
        prompt += `📆 TENDÊNCIA RECENTE (últimos ${recentTrend.length} dias com operações):\n`;
        for (const t of recentTrend) {
            prompt += `- ${t.date}: ${t.greens}G/${t.reds}R, ${t.profit >= 0 ? '+' : ''}${t.profit.toFixed(2)} stakes\n`;
        }
        prompt += `\n`;
    }

    // Params
    if (paramSnapshot && Object.keys(paramSnapshot).length > 0) {
        prompt += `⚙️ PARÂMETROS ATUAIS:\n`;
        for (const [k, v] of Object.entries(paramSnapshot)) {
            if (k !== 'id' && k !== 'owner_id' && k !== 'created_at' && k !== 'updated_at') {
                prompt += `- ${k}: ${v}\n`;
            }
        }
        prompt += `\n`;
    }

    prompt += `Com base nesses dados, forneça um diagnóstico completo e acionável.`;
    return prompt;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
        if (!GEMINI_API_KEY) {
            return new Response(
                JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const input: DiagnosticInput = await req.json();

        if (!input.tab || !input.metrics) {
            return new Response(
                JSON.stringify({ error: "tab and metrics are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const systemPrompt = buildSystemPrompt(input.tab);
        const userPrompt = buildUserPrompt(input);

        const requestBody = {
            system_instruction: {
                parts: [{ text: systemPrompt }],
            },
            contents: [
                { role: "user", parts: [{ text: userPrompt }] },
            ],
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: "analyze_diagnostic",
                            description: "Retorna diagnóstico estruturado completo do método de trading",
                            parameters: {
                                type: "object",
                                properties: {
                                    overallScore: {
                                        type: "number",
                                        description: "Score de 0 a 100 baseado na análise global (lucro, WR, consistência)",
                                    },
                                    classification: {
                                        type: "string",
                                        enum: ["Excelente", "Bom", "Regular", "Atenção", "Crítico"],
                                        description: "Classificação geral do método",
                                    },
                                    summary: {
                                        type: "string",
                                        description: "Resumo executivo em 2-3 frases diretas",
                                    },
                                    strengths: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "3-5 pontos fortes identificados com valores",
                                    },
                                    weaknesses: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "3-5 fraquezas/pontos de atenção com valores",
                                    },
                                    redDeepDive: {
                                        type: "object",
                                        properties: {
                                            pattern: {
                                                type: "string",
                                                description: "Padrão principal identificado nos reds",
                                            },
                                            commonLeagues: {
                                                type: "array",
                                                items: { type: "string" },
                                                description: "Ligas onde reds se concentram",
                                            },
                                            commonCriteria: {
                                                type: "array",
                                                items: { type: "string" },
                                                description: "Critérios/condições correlacionados com reds",
                                            },
                                            recommendation: {
                                                type: "string",
                                                description: "Ação recomendada para reduzir reds",
                                            },
                                        },
                                        required: ["pattern", "commonLeagues", "commonCriteria", "recommendation"],
                                        description: "Análise profunda dos reds",
                                    },
                                    leagueClassification: {
                                        type: "object",
                                        properties: {
                                            strong: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        reason: { type: "string" },
                                                    },
                                                    required: ["name", "reason"],
                                                },
                                                description: "Ligas fortes (manter operando)",
                                            },
                                            weak: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        reason: { type: "string" },
                                                        action: {
                                                            type: "string",
                                                            enum: ["block", "monitor"],
                                                        },
                                                    },
                                                    required: ["name", "reason", "action"],
                                                },
                                                description: "Ligas fracas (bloquear ou monitorar)",
                                            },
                                            insufficient: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        reason: { type: "string" },
                                                    },
                                                    required: ["name", "reason"],
                                                },
                                                description: "Ligas com dados insuficientes",
                                            },
                                        },
                                        required: ["strong", "weak", "insufficient"],
                                        description: "Classificação de ligas",
                                    },
                                    parameterSuggestions: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                param: { type: "string", description: "Nome do parâmetro" },
                                                current: { type: "string", description: "Valor atual" },
                                                suggested: { type: "string", description: "Valor sugerido" },
                                                reason: { type: "string", description: "Motivo da sugestão" },
                                                impact: {
                                                    type: "string",
                                                    enum: ["high", "medium", "low"],
                                                    description: "Impacto esperado da mudança",
                                                },
                                            },
                                            required: ["param", "current", "suggested", "reason", "impact"],
                                        },
                                        description: "Sugestões de ajuste para TODOS os parâmetros analisados (mesmo que a sugestão seja manter o valor atual)",
                                    },
                                    actionPlan: {
                                        type: "array",
                                        items: { type: "string" },
                                        description: "3-5 ações prioritárias e específicas para o trader executar",
                                    },
                                },
                                required: [
                                    "overallScore",
                                    "classification",
                                    "summary",
                                    "strengths",
                                    "weaknesses",
                                    "redDeepDive",
                                    "leagueClassification",
                                    "parameterSuggestions",
                                    "actionPlan",
                                ],
                            },
                        },
                    ],
                },
            ],
            toolConfig: {
                functionCallingConfig: {
                    mode: "ANY",
                    allowedFunctionNames: ["analyze_diagnostic"],
                },
            },
        };

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API error:", response.status, errorText);
            return new Response(
                JSON.stringify({ error: "Erro ao conectar com a IA" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (!candidate?.content?.parts) {
            console.error("No valid response from Gemini:", JSON.stringify(data));
            return new Response(
                JSON.stringify({ error: "Resposta da IA não contém diagnóstico" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Extract function call result
        for (const part of candidate.content.parts) {
            if (part.functionCall?.name === "analyze_diagnostic") {
                return new Response(
                    JSON.stringify({ report: part.functionCall.args }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Fallback: try to extract text
        const textContent = candidate.content.parts.find((p: any) => p.text)?.text;
        if (textContent) {
            try {
                const jsonMatch = textContent.match(/\{[\s\S]*\}/);
                const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(textContent);
                return new Response(
                    JSON.stringify({ report: parsed }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } catch {
                return new Response(
                    JSON.stringify({ report: { summary: textContent, raw: true } }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        return new Response(
            JSON.stringify({ error: "Resposta da IA não contém diagnóstico" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("analyze-diagnostic-report error:", error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : "Erro desconhecido",
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
