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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const breakevenRate = methodData.stats.avgOdd > 1
      ? (1 / methodData.stats.avgOdd) * 100
      : 50;

    // ... [keeping prompt logic intact] ...

    const requestBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      tools: [{
        functionDeclarations: [{
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
            required: ["action", "explanation"]
          }
        }]
      }],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["provide_recommendation"] } }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

    const data = await response.json();

    // Extract the tool call result from Gemini format
    const part = data.candidates?.[0]?.content?.parts?.[0];
    if (part && part.functionCall && part.functionCall.name === "provide_recommendation") {
      try {
        const recommendation = part.functionCall.args;
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
