

## Corrigir inconsistencia entre metricas ao filtrar por metodo

### Problema
Ao filtrar por metodo diferente na pagina de Desempenho, os cards do topo (Lucro Periodo, Lucro Hoje) mostram valores corretos (ex: +3.64st, R$91.09), mas os cards avancados (Run-up Maximo, Maior Lucro, Maior Prejuizo) mostram R$0.00.

### Causa raiz
O hook `useBankrollHealth.ts` usa apenas `op.profit ?? 0` para calcular as metricas. Quando a operacao tem `profit: null` no banco de dados (mas tem `stakeValue`, `odd` e `operationType` preenchidos), o calculo retorna zero.

Enquanto isso, o hook `useOperationalStatus.ts` tem um fallback inteligente via funcao `getOperationProfit()` que chama `calculateProfit()` quando `profit` e nulo, gerando os valores corretos.

### Solucao
Adicionar o mesmo fallback de calculo em tempo real no `useBankrollHealth.ts`, importando `calculateProfit` de `@/utils/profitCalculator`.

### Alteracoes

**1. `src/hooks/useBankrollHealth.ts`**

- Importar `calculateProfit` de `@/utils/profitCalculator`
- Adicionar `commissionRate` como prop opcional (default 0.045)
- Adicionar campos `operationType` e `methodId` ao tipo `MethodOperationWithGame` (operationType ja existe no tipo Game)
- Criar funcao auxiliar `getProfit(op)` que:
  - Se `op.profit` nao for null, usa ele
  - Senao, se tem `stakeValue`, `odd` e `operationType`, calcula via `calculateProfit`
  - Senao, retorna 0
- Substituir todas as ocorrencias de `op.profit ?? 0` por `getProfit(op)`

Trecho da funcao auxiliar:
```typescript
const getProfit = (op: MethodOperationWithGame): number => {
  if (op.profit !== null && op.profit !== undefined) return op.profit;
  if (op.stakeValue && op.odd && op.operationType && op.result) {
    return calculateProfit({
      stakeValue: op.stakeValue,
      odd: op.odd,
      operationType: op.operationType as 'Back' | 'Lay',
      result: op.result as 'Green' | 'Red',
      commissionRate: 0.045,
    });
  }
  return 0;
};
```

**2. Atualizacao do push de operacoes** - garantir que `operationType` seja incluido ao construir `allOperations`:
```typescript
allOperations.push({
  result: op.result,
  profit: op.profit,
  stakeValue: op.stakeValue,
  odd: op.odd,
  operationType: op.operationType,
  methodId: op.methodId,
  gameDate: game.date,
  league: game.league,
});
```

### Resultado esperado
Ao filtrar por qualquer metodo, Run-up Maximo, Drawdown Maximo, Maior Lucro e Maior Prejuizo refletirao os mesmos valores financeiros que os cards do topo, eliminando a inconsistencia.
