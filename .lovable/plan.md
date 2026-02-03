

## Ranking de Ligas por Método

### O Que Será Criado

Um novo componente que mostra **ranking de melhores e piores ligas para cada método específico**, permitindo identificar onde cada estratégia funciona melhor ou pior.

---

### Funcionalidade

Na página de **Desempenho**, abaixo do gráfico de ligas atual:
1. Respeita os filtros de **período**, **método** e **liga** aplicados
2. Mostra para cada método:
   - Top 3 Melhores Ligas (maior win rate + lucro)
   - Top 3 Piores Ligas (menor win rate + prejuízo)
3. Inclui estatísticas detalhadas (win rate, operações, lucro)

---

### Estrutura Visual

```text
┌──────────────────────────────────────────────────────────────┐
│  🏆 Ranking de Ligas por Método                              │
│  Período: 01/01/2026 - 31/01/2026                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚽ BTTS                                                      │
│  ┌─────────────────────────────┬─────────────────────────────┐
│  │ 🏆 MELHORES                 │ ⚠️ PIORES                   │
│  ├─────────────────────────────┼─────────────────────────────┤
│  │ 1. Premier League           │ 1. Serie B Brasil           │
│  │    85% WR • 12 ops • +2.5st │    35% WR • 8 ops • -3.2st  │
│  │ 2. La Liga                  │ 2. Ligue 2                  │
│  │    78% WR • 9 ops • +1.8st  │    40% WR • 5 ops • -2.0st  │
│  │ 3. Serie A                  │ 3. Championship             │
│  │    72% WR • 15 ops • +1.2st │    45% WR • 10 ops • -1.5st │
│  └─────────────────────────────┴─────────────────────────────┘
│                                                              │
│  🎯 Over 1.5 HT                                              │
│  ┌─────────────────────────────┬─────────────────────────────┐
│  │ 🏆 MELHORES                 │ ⚠️ PIORES                   │
│  ├─────────────────────────────┼─────────────────────────────┤
│  │ 1. Bundesliga               │ 1. Eredivisie               │
│  │    80% WR • 10 ops • +2.0st │    30% WR • 6 ops • -2.8st  │
│  │ ...                         │ ...                         │
│  └─────────────────────────────┴─────────────────────────────┘
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `vite.config.ts` | Aumentar limite do PWA para corrigir erro de build |
| `src/hooks/useFilteredStatistics.ts` | Adicionar cálculo de `leagueStatsByMethod` |
| `src/components/Charts/LeagueRankingByMethod.tsx` | Novo componente de ranking |
| `src/pages/Performance.tsx` | Adicionar componente na página |

---

### Detalhes Técnicos

#### 1. Correção do Erro de Build (PWA)

Adicionar `maximumFileSizeToCacheInBytes` na configuração do PWA:

```typescript
injectManifest: {
  globPatterns: ["**/*.{js,css,html,ico,png,svg,mp3}"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
},
```

#### 2. Nova Estrutura de Dados

```typescript
interface LeagueStatsByMethod {
  methodId: string;
  methodName: string;
  leagues: {
    league: string;
    total: number;
    greens: number;
    reds: number;
    winRate: number;
    profit: number; // em stakes
  }[];
  bestLeagues: LeagueStats[];  // Top 3 por winRate + lucro
  worstLeagues: LeagueStats[]; // Bottom 3 por winRate + prejuízo
}
```

#### 3. Lógica de Ranking

Para cada método:
1. Agrupar operações por liga
2. Calcular win rate e lucro (em stakes) por liga
3. Ordenar por **score combinado**: `winRate * 0.6 + normalizedProfit * 0.4`
4. Top 3 = melhores, Bottom 3 = piores
5. Filtrar ligas com mínimo 3 operações (para relevância estatística)

#### 4. Componente Visual

- Cards colapsáveis por método
- Cores: Verde para melhores, Vermelho para piores
- Badges com Win Rate e Lucro
- Indicador de volume (operações)
- Responsivo: em mobile, melhores/piores empilhados

---

### Benefícios

1. **Insights específicos** - Ver onde cada método brilha ou falha
2. **Decisões melhores** - Saber quais ligas evitar para cada estratégia
3. **Filtrado** - Respeita todos os filtros aplicados
4. **Acionável** - Identificar oportunidades de melhoria

---

### Ordem de Implementação

1. Corrigir erro de build do PWA (aumentar limite de cache)
2. Adicionar cálculo `leagueStatsByMethod` no hook
3. Criar componente `LeagueRankingByMethod`
4. Integrar na página de Desempenho
5. Testar com diferentes filtros

