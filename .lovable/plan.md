

## Corrigir inconsistencia entre metricas ao filtrar por metodo

### Problema
Ao filtrar por metodo na pagina de Desempenho, os cards do topo (Lucro Periodo, Lucro Hoje) mostram valores corretos, mas os cards avancados (Run-up Maximo, Maior Lucro, Maior Prejuizo) mostram R$0.00.

### Causa raiz
O hook `useBankrollHealth.ts` usa `op.profit ?? 0` para calcular metricas. Quando `profit` e `null` no banco (mas tem `stakeValue`, `odd` e `operationType`), retorna zero. Enquanto o `useOperationalStatus.ts` tem fallback via `calculateProfit()` que gera os valores corretos.

### Alteracoes

**`src/hooks/useBankrollHealth.ts`**

1. Importar `calculateProfit` de `@/utils/profitCalculator`
2. Adicionar campo `operationType` ao tipo `MethodOperationWithGame`
3. Incluir `operationType` ao construir `allOperations`
4. Criar funcao auxiliar `getProfit(op)` com fallback inteligente:
   - Se `op.profit` existe, usa ele
   - Senao, calcula via `calculateProfit` se tem `stakeValue`, `odd`, `operationType` e `result`
   - Senao, retorna 0
5. Substituir todas as ocorrencias de `op.profit ?? 0` por `getProfit(op)`

### Resultado esperado
Run-up Maximo, Drawdown Maximo, Maior Lucro e Maior Prejuizo refletirao os mesmos valores financeiros que os cards do topo ao filtrar por qualquer metodo.

