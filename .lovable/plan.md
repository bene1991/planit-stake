
## Corrigir Som de Gol Duplicado - Causa Raiz Real

### Problema

O useEffect que controla o polling (linha 373-427 do `useLiveScores.ts`) tem `games` no array de dependencias. Quando um gol e detectado:

1. `handleGoalDetected` -> `playGoalSound()` (1o som)
2. Score e persistido no banco -> `onScorePersisted` -> `games` array atualiza
3. `games` mudou -> useEffect re-executa -> chama `fetchLiveScoresRef.current?.()` imediatamente (linha 412)
4. A nova chamada pode passar pelo throttle de 10s se houver tempo suficiente, e detecta o "mesmo gol" novamente

O `notifiedGoalsRef` deveria bloquear, mas como `fetchLiveScores` e recriado com cada render (tem `games` nas deps do useCallback), e o timing entre chamadas pode ser imprevisivel, ha uma janela para duplicacao.

### Solucao

**Arquivo: `src/hooks/useLiveScores.ts`**

1. **Remover `games` das dependencias do useEffect de polling** - Substituir pela variavel `hasLiveGames` memoizada. O `games` so era usado para verificar se havia jogos ao vivo (`games.some(g => g.status === 'Live')`). Isso pode ser extraido para um `useMemo`.

2. **Remover `games` das dependencias do `fetchLiveScores` useCallback** - O `games` dentro do callback pode ser acessado via ref para evitar que o callback seja recriado a cada mudanca do array. Isso previne cascatas de re-render que causam chamadas duplicadas.

### Detalhes Tecnicos

Mudancas em `src/hooks/useLiveScores.ts`:

1. Adicionar `useMemo` para `hasLiveGames`:
```
const hasLiveGames = useMemo(() => games.some(g => g.status === 'Live'), [games]);
```

2. Adicionar `useRef` para `games` (para usar dentro do callback sem depender dele):
```
const gamesRef = useRef(games);
useEffect(() => { gamesRef.current = games; }, [games]);
```

3. No `fetchLiveScores` useCallback, usar `gamesRef.current` em vez de `games` diretamente, e remover `games` das deps do useCallback

4. No useEffect de polling (linha 373), substituir `games` por `hasLiveGames`:
```
}, [hasGamesToMonitor, fixtureIds.length, hasLiveGames, isPageVisible, activeIntervalMs]);
```

Isso quebra o ciclo: gol detectado -> score persistido -> games atualiza -> MAS o useEffect de polling NAO re-executa (porque `hasLiveGames`, `hasGamesToMonitor` e `fixtureIds.length` nao mudaram). O som toca apenas 1 vez.
