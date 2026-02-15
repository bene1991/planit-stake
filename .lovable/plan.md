

## Mostrar cartoes vermelhos visualmente no card do jogo

### Problema

A API retorna corretamente os cartoes vermelhos no campo `key_events` (ex: fixture 1392043 do Huesca mostra `"type":"red_card","minute":29,"player":"M. Fernandez Sanchez"`). Porem, o `GameListItem` so extrai e exibe **gols** dos `key_events` (linha 198: `filter(e => e.type === 'goal')`). Nao existe nenhum codigo para mostrar cartoes vermelhos no card.

### Solucao

Adicionar extracao e exibicao de eventos de cartao vermelho no `GameListItem.tsx`, logo abaixo dos gols de cada time, usando o mesmo padrao visual.

### Alteracoes

**`src/components/GameListItem.tsx`**

1. Adicionar um `useMemo` similar ao de gols para extrair cartoes vermelhos do `key_events`:

```typescript
const { homeRedCards, awayRedCards } = useMemo(() => {
  if (fixtureCache?.key_events?.length) {
    const reds = fixtureCache.key_events.filter(e => e.type === 'red_card');
    return {
      homeRedCards: reds.filter(e => e.team === 'home'),
      awayRedCards: reds.filter(e => e.team === 'away'),
    };
  }
  return { homeRedCards: [], awayRedCards: [] };
}, [fixtureCache?.key_events]);
```

2. Renderizar abaixo dos gols de cada time (home e away), com icone vermelho:

```tsx
{homeRedCards.length > 0 && (
  <div className="ml-5 sm:ml-7 mb-1">
    {homeRedCards.map((rc, i) => (
      <span key={i} className="text-[9px] sm:text-[10px] text-red-400 mr-2">
        🟥 {rc.player} {rc.minute}'
      </span>
    ))}
  </div>
)}
```

Mesmo padrao para `awayRedCards` abaixo dos gols do visitante.

### Resultado esperado

No card do jogo Huesca vs AD Ceuta FC, vai aparecer:
- Linha do gol: "J. Escobar 47'"
- Linha do cartao: "🟥 M. Fernandez Sanchez 29'" (em vermelho, abaixo dos gols do time visitante)
