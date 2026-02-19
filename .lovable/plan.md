

## Corrigir ordenacao por horario na mensagem de Planejamento do Telegram

### Problema

A ordenacao cronologica foi corrigida apenas no componente de **Resumo** (`TelegramSummaryMessage.tsx`), mas a mensagem de **Planejamento** (`TelegramPlanningMessage.tsx`) nunca recebeu essa correcao. A funcao `buildTelegramGames` simplesmente itera os jogos na ordem do array original, sem nenhum sort. Por isso o jogo das 16:00 aparece depois dos jogos das 17:00.

### Solucao

**Arquivo: `src/components/TelegramPlanningMessage.tsx`**

Adicionar ordenacao cronologica na funcao `buildTelegramGames`, apos montar o array `result`, usando a mesma logica numerica que ja existe no resumo:

```typescript
result.sort((a, b) => {
  const [ah, am] = a.time.split(':').map(Number);
  const [bh, bm] = b.time.split(':').map(Number);
  return (ah * 60 + am) - (bh * 60 + bm);
});
```

Isso garante que os jogos sejam listados de 14:45, 16:00, 17:00, 17:00 em vez da ordem arbitraria atual.

### Resultado esperado

A mensagem de planejamento listara os jogos em ordem cronologica correta:
1. Fenerbahce x Nottingham Forest - 14:45
2. Al-Ettifaq x Al-Fateh - 16:00
3. Celtic x VfB Stuttgart - 17:00
4. Ludogorets x Ferencvarosi TC - 17:00

