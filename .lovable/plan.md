
## Mostrar qual jogo tem dados financeiros incompletos

### Problema
O alerta "1 de 420 operacoes sem dados financeiros completos (stake/odd)" nao indica qual jogo especifico tem o problema, dificultando a correcao.

### Solucao

**1. `src/hooks/useOperationalStatus.ts`**
- Adicionar campo `gameId` e `gameLabel` (ex: "Flamengo x Vasco") ao tipo `OperationWithDate`
- Ao iterar as operacoes sem dados financeiros, coletar os nomes dos jogos afetados
- Adicionar ao `OperationalMetrics` um novo campo `gamesWithIncompleteData: { id: string; label: string; date: string }[]` com a lista dos jogos que tem operacoes incompletas

**2. `src/pages/Performance.tsx`**
- No alerta amarelo, listar os jogos afetados abaixo da mensagem principal
- Formato: "Time A x Time B (data)" para cada jogo com dados incompletos
- Se houver muitos jogos (>5), mostrar os primeiros 5 com um "e mais X jogos..."

### Detalhes tecnicos

No `useOperationalStatus.ts`, ao construir `allOperations`, adicionar `gameId` e `gameLabel`:

```typescript
allOperations.push({
  ...
  gameId: game.id,
  gameLabel: `${game.homeTeam} x ${game.awayTeam}`,
});
```

Depois, ao calcular `operationsWithoutFinancialData`, tambem coletar os jogos unicos:

```typescript
const incompleteOps = periodOps.filter(op => !(op.stakeValue && op.odd && op.operationType));
const uniqueGames = new Map();
incompleteOps.forEach(op => {
  if (!uniqueGames.has(op.gameId)) {
    uniqueGames.set(op.gameId, { id: op.gameId, label: op.gameLabel, date: op.date });
  }
});
const gamesWithIncompleteData = Array.from(uniqueGames.values());
```

No `Performance.tsx`, exibir os jogos no alerta:

```
[!] 1 de 420 operacoes sem dados financeiros completos (stake/odd).
    - Flamengo x Vasco (2026-02-14)
```
