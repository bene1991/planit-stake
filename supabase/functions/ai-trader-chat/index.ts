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

        const { result, context, odd, game, market } = await req.json();

        if (!result || !context) {
            return new Response(JSON.stringify({ error: 'Faltam dados matemáticos para a análise' }), { status: 400, headers: corsHeaders });
        }

        const marketNames: Record<string, string> = {
            'lay_0x1': 'Lay 0x1 (Contra o 0 a 1)',
            'lay_1x0': 'Lay 1x0 (Contra o 1 a 0)',
            'back_home': 'Back Casa (A favor do Mandante)',
            'back_away': 'Back Fora (A favor do Visitante)',
            'lay_home': 'Lay Casa (Contra o Mandante)',
            'lay_away': 'Lay Fora (Contra o Visitante)'
        };
        const marketLabel = market ? marketNames[market] || market : 'Mercado Desconhecido';

        const prompt = `Você é um Assistente especializado em inteligência de dados esportivos focado no mercado de '${marketLabel}'.
A interface do usuário funciona como um Chat. A matemática pesada de probabilidade, gestão de banca e limites de risco já foi computada pelo sistema e repassada a você abaixo.

**Identificação do Evento:**
- Fixture ID: ${context.fixtureId}
- Mandante: ${game?.homeTeam || 'Desconhecido'} vs Visitante: ${game?.awayTeam || 'Desconhecido'}
- Liga: ${game?.league || 'N/A'} (Tier: ${context.leagueTier || 'N/A'})

**Estatísticas Pré-Live Extraídas:**
- Lambda Mandante (Força Ofensiva Casa): ${context.lambdaHome.toFixed(2)}
- Lambda Visitante (Força Ofensiva Fora): ${context.lambdaAway.toFixed(2)}
- Lambda Total Esperado: ${context.lambdaTotal.toFixed(2)}

**Parâmetros de Precificação (Já com matemática feita):**
- Odd Selecionada no Mercado: ${odd.toFixed(2)}
- Probabilidade Real (Poisson): ${result.prob.toFixed(1)}%
- Odd Justa Calculada para ${marketLabel}: ${result.fairOdd.toFixed(2)}
- Edge (Margem) Encontrado: ${result.edge.toFixed(1)}% *(${result.edge > 0 ? 'Bom' : 'Ruim, EV-'})*

**Gerenciamento de Risco e Gestão de Banca Escrita:**
- Sugestão Stake do Robô: R$ ${result.suggestedStake.toFixed(2)} (${result.suggestedStakePct.toFixed(1)}% da banca)
- Responsabilidade Associada: R$ ${result.liability.toFixed(2)} (${result.liabilityPct.toFixed(1)}% da banca)
- O Teto máximo de responsabilidade foi atingido forçando recálculo? ${result.isStakeReduced ? 'SIM' : 'NÃO'}

---
⚠️ INSTRUÇÃO CRÍTICA PARA A IA ⚠️
Não realize NENHUM cálculo matemático de odd justa, stake ou probabilidade. Confie inteiramente nos números passados acima, eles são a fonte de verdade.
Seu trabalho é interpretar esse cenário e devolver no CHAT uma mensagem estratégica como se estivesse conversando, utilizando a formatação obrigatória:

⚽ Cenário
*(Faça a leitura dos lambdas, se o jogo tende a gols ou se o ataque mandante/visitante está forte/fraco baseado no lambda. Relacione isso com o mercado escolhido: '${marketLabel}')*

📊 Probabilidade Real
*(Comente sobre o percentual de chance calculado e se a Odd Justa gerada vs Mercado está atrativa para o mercado de ${marketLabel})*

📈 Edge
*(Destaque a margem + ou - achada, e se há valor em fazer a operação pré-live)*

💰 Gestão (Stake + Responsabilidade)
*(Comente a stake selecionada, a % da responsabilidade da banca, e alerte forte se "O Teto de responsabilidade foi atingido" reduzindo a stake)*

🛑 Plano de Saída
*(Sugira uma regra para fechar a posição se preciso for durante o jogo, como gol iminente ou tempo limite)*

⚠️ Riscos
*(Sintetize os maiores riscos dessa operação específica)*

Seja direto, claro e use tom firme de analista quant. Não use blocos de código markdown. Formate bonito e profissional o chat.`;

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
        if (!GEMINI_API_KEY) {
            return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), { status: 500, headers: corsHeaders });
        }

        const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [{ text: 'Você é o AI Trader Assistant do PlanIt Stake. Forneça análise estruturada baseada puramente nos inputs.' }]
                },
                contents: [
                    { role: 'user', parts: [{ text: prompt }] },
                ],
            }),
        });

        if (!aiResponse.ok) {
            const status = aiResponse.status;
            console.error('AI error:', status, await aiResponse.text());
            return new Response(JSON.stringify({ error: 'Gemini API error' }), { status: 500, headers: corsHeaders });
        }

        const aiData = await aiResponse.json();
        const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return new Response(
            JSON.stringify({ message: content }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        console.error('Error in ai-trader-chat:', error);
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
