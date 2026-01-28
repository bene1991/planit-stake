
## Plano: Enriquecer Dados Enviados à IA para Análise Completa

### Problema Identificado
A IA está gerando análises focadas demais no **Win Rate** porque os dados que enviamos para ela são incompletos. Especificamente:

1. **Dados de método incompletos**: Enviamos apenas WinRate, total, greens, reds - **não incluímos lucro em R$, score combinado, ou dias ativos**
2. **Prompt do sistema superficial**: Não explicamos claramente os pesos e como a IA deve balancear os diferentes fatores
3. **Contexto financeiro ausente**: A IA não recebe informações sobre maior lucro/prejuízo individual, stake médio, etc.

### Solução

#### 1. Enriquecer os `methodStats` Enviados
Adicionar campos críticos que já existem no sistema mas não estão sendo transmitidos:

| Campo Atual | Campos a Adicionar |
|-------------|-------------------|
| methodName | profitReais (lucro em R$) |
| total | combinedScore (score 0-100) |
| greens | activeDays (dias com operações) |
| reds | breakeven (taxa mínima para lucro) |
| winRate | previousWinRate (comparação) |

#### 2. Reformular o Prompt do Sistema
Atualizar as regras para a IA considerar com peso adequado:

```
CRITÉRIOS DE ANÁLISE (PESOS):
1. LUCRO FINANCEIRO (40%): O resultado em R$ é o que importa no final
2. WIN RATE vs BREAKEVEN (35%): Taxa de acerto relativa ao mínimo necessário
3. VOLUME E CONSISTÊNCIA (25%): Número de operações e dias ativos

REGRAS OBRIGATÓRIAS:
- NÃO foque apenas em Win Rate - analise o LUCRO em R$ de cada método
- Compare o combinedScore dos métodos, não apenas o WR
- Considere métodos com alto volume como mais confiáveis estatisticamente
- Valorize consistência: métodos presentes em muitos dias são mais estáveis
```

#### 3. Adicionar Contexto Financeiro Extra
Enviar informações adicionais:
- Lucro total em R$ (não apenas stakes)
- Maior lucro individual e maior prejuízo individual
- Stake médio utilizado

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/components/AIPerformanceAnalyzer.tsx` | Enriquecer `methodStats` com profitReais, combinedScore, activeDays, breakeven |
| `supabase/functions/analyze-performance/index.ts` | Atualizar interface e prompt do sistema com pesos explícitos |

### Detalhes Técnicos

#### Mudanças no AIPerformanceAnalyzer.tsx

```typescript
// ANTES (incompleto)
methodStats: statistics.methodDetailStats.map(m => ({
  methodName: m.methodName,
  total: m.total,
  greens: m.greens,
  reds: m.reds,
  winRate: m.winRate,
})),

// DEPOIS (completo)
methodStats: statistics.methodDetailStats.map(m => ({
  methodName: m.methodName,
  total: m.total,
  greens: m.greens,
  reds: m.reds,
  winRate: m.winRate,
  profitReais: m.profitReais,           // ✅ NOVO
  combinedScore: m.combinedScore,        // ✅ NOVO
  activeDays: m.activeDays,              // ✅ NOVO
})),

// Adicionar lucro total em R$
totalProfitReais: totalProfit,           // ✅ NOVO
```

#### Mudanças na Edge Function

1. **Atualizar interface `PerformanceData`**:
```typescript
methodStats: Array<{
  methodName: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  profitReais: number;      // NOVO
  combinedScore: number;    // NOVO
  activeDays: number;       // NOVO
}>;
totalProfitReais?: number;   // NOVO
```

2. **Atualizar prompt do sistema**:
```typescript
const systemPrompt = `Você é um analista especializado em trading esportivo...

CRITÉRIOS DE ANÁLISE - USE ESTES PESOS:
1. LUCRO FINANCEIRO (40%): O resultado em R$ é a métrica mais importante
   - Analise o profitReais de cada método
   - Valorize métodos lucrativos mesmo com WR médio

2. WIN RATE vs BREAKEVEN (35%): Taxa de acerto relativa ao mínimo
   - Compare winRate com breakeven do método
   - Métodos acima do breakeven são saudáveis

3. VOLUME E CONSISTÊNCIA (25%): Significância estatística
   - Métodos com +30 operações são mais confiáveis
   - Métodos presentes em muitos dias (activeDays) são mais estáveis
   - Use o combinedScore como referência

REGRAS OBRIGATÓRIAS:
- NÃO analise apenas Win Rate - o LUCRO em R$ é mais importante
- Cite valores específicos em R$ nos pontos positivos/negativos
- Compare combinedScore dos métodos ao ranquear performance
- Valorize consistência: métodos em muitos dias são mais confiáveis
`;
```

3. **Atualizar userPrompt** para mostrar lucro por método:
```typescript
📈 PERFORMANCE POR MÉTODO:
${performanceData.methodStats.map(m => 
  `- ${m.methodName}: ${m.winRate}% WR, ${m.profitReais >= 0 ? '+' : ''}R$${m.profitReais.toFixed(2)}, Score: ${m.combinedScore}/100 (${m.total} ops em ${m.activeDays} dias)`
).join('\n')}

💰 LUCRO TOTAL: R$ ${performanceData.totalProfitReais?.toFixed(2) || profit}
```

### Resultado Esperado

**Antes (foco em WR):**
```
✅ Pontos Positivos
• Excelente performance no método 'Valdomiro' com 83% de WR em 53 operações
```

**Depois (análise balanceada):**
```
✅ Pontos Positivos
• Método 'Valdomiro' é o mais rentável com +R$892 de lucro (Score 87/100)
• Win Rate de 83% está 34pp acima do breakeven necessário
• Alta consistência: presente em 45 dos 52 dias operados
```

### Benefícios
1. **Análise mais precisa**: IA considera todos os fatores importantes
2. **Foco no resultado real**: Lucro em R$ tem destaque adequado
3. **Contexto completo**: Score combinado e consistência são mencionados
4. **Dados acionáveis**: Informações específicas para tomada de decisão
