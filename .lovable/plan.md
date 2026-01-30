

## Plano: Corrigir Métricas Avançadas para Respeitar Filtro de Método

### Problema Identificado

As métricas de saúde da banca (Drawdown Máximo, Maior Lucro, Maior Prejuízo, etc.) **não respeitam o filtro de método selecionado**. Isso acontece em dois pontos:

| Local | Problema |
|-------|----------|
| `Performance.tsx` linha 169-176 | Filtra jogos apenas por data, ignora `filters.selectedMethods` |
| `useBankrollHealth.ts` linha 63-77 | Extrai TODAS as operações sem filtrar por método |

### Solução

Adicionar suporte ao filtro de método no hook `useBankrollHealth`:

1. Adicionar nova prop `selectedMethods?: string[]` na interface
2. Ao extrair operações, filtrar apenas as que pertencem aos métodos selecionados
3. Atualizar `Performance.tsx` para passar `filters.selectedMethods`
4. Atualizar `AIPerformanceAnalyzer.tsx` para passar os métodos selecionados

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useBankrollHealth.ts` | Adicionar prop e lógica de filtro por método |
| `src/pages/Performance.tsx` | Passar `selectedMethods` para o hook |
| `src/components/AIPerformanceAnalyzer.tsx` | Passar `selectedMethods` para o hook |

### Detalhes Técnicos

#### 1. Atualizar Interface do Hook

```typescript
// src/hooks/useBankrollHealth.ts
interface UseBankrollHealthProps {
  games: Game[];
  totalProfit: number;
  winRate: number;
  breakevenRate: number;
  targetMonthlyStakes?: number;
  stakeValueReais?: number;
  bankrollTotal?: number;
  uniqueLeagues?: number;
  uniqueMethods?: number;
  selectedMethods?: string[];  // NOVO: IDs dos métodos selecionados
}
```

#### 2. Filtrar Operações por Método

```typescript
// ANTES (sem filtro de método)
games.forEach(game => {
  game.methodOperations?.forEach(op => {
    if (op.result) {
      allOperations.push({ ... });
    }
  });
});

// DEPOIS (com filtro de método)
games.forEach(game => {
  game.methodOperations?.forEach(op => {
    if (!op.result) return;
    
    // Filtrar por método se houver seleção
    if (selectedMethods && selectedMethods.length > 0) {
      if (!selectedMethods.includes(op.methodId)) return;
    }
    
    allOperations.push({ ... });
  });
});
```

#### 3. Atualizar Performance.tsx

```typescript
const healthMetrics = useBankrollHealth({
  games: games.filter(g => {
    if (filters.dateFrom && filters.dateTo) {
      const gameDate = new Date(`${g.date}T12:00:00`);
      return gameDate >= filters.dateFrom && gameDate <= filters.dateTo;
    }
    return true;
  }),
  totalProfit: totalProfitReais,
  winRate: overallStats.winRate,
  breakevenRate,
  targetMonthlyStakes: settings.metaMensalStakes,
  stakeValueReais: parsedStake,
  bankrollTotal: bankroll.total,
  uniqueLeagues: leagueStats.length,
  uniqueMethods: methodDetailStats.length,
  selectedMethods: filters.selectedMethods,  // NOVO
});
```

### Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Drawdown Máximo | Sempre mostra de todos os métodos | Mostra apenas do(s) método(s) filtrado(s) |
| Maior Lucro | Sempre mostra de todos os métodos | Mostra apenas do(s) método(s) filtrado(s) |
| Maior Prejuízo | Sempre mostra de todos os métodos | Mostra apenas do(s) método(s) filtrado(s) |
| Taxa de Recuperação | Sempre mostra de todos os métodos | Mostra apenas do(s) método(s) filtrado(s) |
| Risco de Ruína | Sempre mostra de todos os métodos | Mostra apenas do(s) método(s) filtrado(s) |

### Benefícios

1. **Consistência**: Todas as métricas respeitam os mesmos filtros
2. **Análise precisa**: Usuário pode analisar drawdown de um método específico
3. **Decisões melhores**: Identificar quais métodos têm maior risco

