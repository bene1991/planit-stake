
## Plano: Dashboard Avançado de Análise IA - "Saúde da Banca"

### Objetivo
Implementar um dashboard de análise avançada inspirado no "my bet space", com Score da Banca, métricas financeiras detalhadas, análise estruturada por IA (Pontos Positivos/Negativos/Sugestões), e "Raio X do Método".

### O que já existe no seu sistema (e podemos aproveitar):
- Edge function `analyze-performance` com Lovable AI
- Componente `AIPerformanceAnalyzer` funcional com streaming
- Hook `useFilteredStatistics` com dados completos (lucro, WR, ligas, times, faixas de odd)
- Hook `useOperationalStatus` com cálculos de streak, drawdown, peak profit
- Página Performance.tsx com muitas métricas já implementadas

### Novas Funcionalidades

#### 1. Score da Banca (0-100)
Um score calculado automaticamente baseado em múltiplos fatores:
- Win Rate relativo ao breakeven (peso 25%)
- Profit vs Meta (peso 20%)
- Consistência diária (peso 15%)
- Drawdown atual vs máximo histórico (peso 15%)
- Volume de operações (peso 10%)
- Diversificação de ligas/métodos (peso 15%)

Classificação visual:
- 80-100: Verde ("Excelente")
- 60-79: Azul ("Bom")
- 40-59: Amarelo ("Regular")
- 20-39: Laranja ("Atenção")
- 0-19: Vermelho ("Crítico")

#### 2. Cards de Métricas Avançadas
Novos KPIs além dos existentes:
- **Taxa de Recuperação REAL**: Lucro total / Prejuízo total
- **Coeficiente de Ruína**: Baseado no drawdown máximo vs banca
- **Run-up Máximo**: Maior sequência positiva em R$
- **Drawdown Máximo**: Maior queda em R$ (já temos, melhorar UI)
- **Maior Lucro / Maior Prejuízo**: Operações individuais extremas

#### 3. Análise IA Estruturada
Modificar a edge function para retornar dados estruturados:
- **Pontos Positivos**: Lista de 3-5 pontos fortes identificados
- **Pontos Negativos**: Lista de 3-5 problemas identificados
- **Sugestões**: Lista de 3-5 ações práticas recomendadas
- **Resumo Geral**: Texto curto de 2-3 frases sobre a saúde geral
- **Score Calculado pela IA**: 0-100 baseado nos dados

#### 4. "Raio X do Método"
Quando um método específico é selecionado nos filtros:
- Score específico do método (0-100)
- Comparativo com performance geral
- Pontos fortes/fracos daquele método
- Gráficos específicos (dias, distribuição, média)

#### 5. Componentes Visuais Novos
- **BankrollScoreCard**: Barra de progresso com score 0-100
- **DonutChartCard**: Para visualizar maior lucro/prejuízo individual
- **MethodSummaryStats**: Cards com Dias/Número/Maior/Média
- **AIInsightsCards**: Cards separados para Positivos/Negativos/Sugestões

### Implementação Técnica

#### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/components/BankrollHealthScore.tsx` | Componente de score 0-100 com barra e classificação |
| `src/components/AIStructuredAnalysis.tsx` | Cards de Pontos Positivos/Negativos/Sugestões |
| `src/components/AdvancedMetricsCards.tsx` | Métricas avançadas (Taxa Recuperação, Coef. Ruína) |
| `src/components/ProfitDonutCharts.tsx` | Gráficos donut Maior Lucro/Prejuízo |
| `src/hooks/useBankrollHealth.ts` | Hook para calcular score e métricas avançadas |

#### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/analyze-performance/index.ts` | Usar tool calling para retornar análise estruturada (pontos +/-/sugestões) |
| `src/components/AIPerformanceAnalyzer.tsx` | Atualizar para exibir análise estruturada em cards |
| `src/pages/Performance.tsx` | Integrar novos componentes na UI |
| `src/hooks/useFilteredStatistics.ts` | Adicionar cálculos de maior lucro/prejuízo individual |

### Fluxo da Edge Function com Tool Calling

A edge function usará tool calling do Lovable AI para obter output estruturado:

```typescript
body.tools = [{
  type: "function",
  function: {
    name: "analyze_bankroll_health",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Score 0-100" },
        classification: { type: "string", enum: ["Excelente", "Bom", "Regular", "Atenção", "Crítico"] },
        summary: { type: "string", description: "Resumo 2-3 frases" },
        positivePoints: { type: "array", items: { type: "string" } },
        negativePoints: { type: "array", items: { type: "string" } },
        suggestions: { type: "array", items: { type: "string" } }
      }
    }
  }
}];
```

### UI Final Esperada

```
┌──────────────────────────────────────────────────────────────┐
│  SCORE DA BANCA                                    [Analisar] │
│  ██████████████████████░░░░░░  80  [Bom]                      │
│  Última análise: 27/01/2026                                   │
├──────────────────────────────────────────────────────────────┤
│  📊 Resumo da IA:                                             │
│  A banca apresenta saúde geral boa: lucro robusto sustentado  │
│  por uma taxa de acerto consistente...                        │
├─────────────────────┬─────────────────────┬──────────────────┤
│  ✅ Pontos Positivos │  ⚠️ Pontos Negativos │  💡 Sugestões    │
│  • Lucro consistente │  • Perdas em poucos  │  • Padronizar    │
│  • Taxa de acerto    │    dias              │    stake         │
│  • Alto volume       │  • Drawdown alto     │  • Reduzir       │
│                      │                      │    exposição     │
├─────────────────────┴─────────────────────┴──────────────────┤
│  [Maior Lucro 7%]  [Resumo: Dias/Número]  [Maior Prejuízo 3%] │
├──────────────────────────────────────────────────────────────┤
│  Run-up    R$ 510   │  Drawdown   R$ 305  │  Tx Recup   1.22  │
│  ████████░░░░░░░░░  │  █████████████░░░░  │  ████████░░  Boa  │
└──────────────────────────────────────────────────────────────┘
```

### Benefícios

1. **Visualização clara da saúde da banca** com score único
2. **Análise estruturada** facilita leitura e ação
3. **Métricas avançadas** para traders experientes
4. **Contexto por método** quando filtrado
5. **UI premium** inspirada no design escuro profissional
6. **Aproveita 100%** da infraestrutura existente (Lovable AI, hooks, dados)

### Ordem de Implementação

1. Criar hook `useBankrollHealth.ts` com cálculos de score e métricas
2. Criar componente `BankrollHealthScore.tsx` com barra de progresso
3. Atualizar edge function para usar tool calling e retornar dados estruturados
4. Criar componente `AIStructuredAnalysis.tsx` com 3 cards
5. Criar componentes de gráficos donut e métricas avançadas
6. Integrar tudo na página Performance.tsx
7. Ajustar responsividade e dark theme
