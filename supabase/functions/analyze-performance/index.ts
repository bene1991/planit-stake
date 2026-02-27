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
    profitReais: number;
    combinedScore: number;
    activeDays: number;
  }>;
  totalProfitReais?: number;
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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const hasFilters = performanceData.isFiltered;
    // ... [keeping prompt construction the same] ...

    // Build request body for Gemini API
    const requestBody: any = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] }
      ],
    };

    // Add tool calling for structured output
    if (structuredOutput) {
      requestBody.tools = [{
        functionDeclarations: [{
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
            required: ["score", "classification", "summary", "positivePoints", "negativePoints", "suggestions"]
          }
        }]
      }];
      requestBody.toolConfig = { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["analyze_bankroll_health"] } };
    }

    const endpoint = structuredOutput
      ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erro ao conectar com a IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle structured output (non-streaming)
    if (structuredOutput) {
      const data = await response.json();

      // Extract the tool call result from Gemini format
      const part = data.candidates?.[0]?.content?.parts?.[0];
      if (part && part.functionCall && part.functionCall.name === "analyze_bankroll_health") {
        try {
          const analysis: StructuredAnalysis = part.functionCall.args;
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
    // Note: Gemini SSE format is slightly different from OpenAI, but the frontend might handle standard SSE.
    // Ideally the frontend parses the SSE stream expecting data: {"candidates":...}
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
