
## Corrigir Som de Gol Duplicado

### Causa Raiz

O som de gol toca duas vezes porque existem **dois loops de refresh independentes** que competem entre si:

1. **Loop interno do `useLiveScores`** (useEffect linha 412) - chama `fetchLiveScores` imediatamente quando o effect re-executa, e a cada X segundos
2. **`useAutoRefresh`** em DailyPlanning - chama `handleGlobalRefresh` → `refreshLiveScores()` em outro intervalo

Quando o `games` array muda de referencia (ex: ao persistir um score), o useEffect do `useLiveScores` re-executa e faz um fetch imediato. Se isso coincide com o ciclo do `useAutoRefresh`, duas chamadas acontecem quase simultaneamente. O `notifiedGoalsRef` deveria prevenir isso, MAS existe uma race condition: as duas chamadas podem estar executando em paralelo (a flag `isFetchingRef` bloqueia uma, mas o timing pode permitir ambas).

Alem disso, o debounce de 3 segundos no `playGoalSound` e insuficiente se as duas chamadas acontecem com menos de 3s de diferenca, mas o som pode ser enfileirado pelo browser.

### Solucao (3 camadas de protecao)

**Arquivo: `src/hooks/useLiveScores.ts`**

1. **Remover chamada duplicada do `useAutoRefresh`**: Em `DailyPlanning.tsx`, remover `refreshLiveScores()` do `handleGlobalRefresh`. O `useLiveScores` ja tem seu proprio loop de polling - nao precisa de dois loops.

**Arquivo: `src/pages/DailyPlanning.tsx`**

2. **Simplificar `handleGlobalRefresh`**: Remover a chamada a `refreshLiveScores()` dentro de `handleGlobalRefresh`, deixando apenas `updateStatuses()`. O polling do `useLiveScores` ja cuida da atualizacao dos scores.

**Arquivo: `src/utils/soundManager.ts`**

3. **Aumentar debounce do som de gol**: Subir o `GOAL_SOUND_DEBOUNCE` de 3000ms para 5000ms como camada extra de seguranca.

### Detalhes Tecnicos

```text
ANTES (dois loops):
useAutoRefresh ──interval──> handleGlobalRefresh ──> refreshLiveScores() ──> fetchLiveScores()
useLiveScores  ──interval──> fetchLiveScoresRef.current()                ──> fetchLiveScores()
                                                                              |
                                                            Ambos detectam gol → som toca 2x

DEPOIS (um loop apenas):
useAutoRefresh ──interval──> handleGlobalRefresh ──> updateStatuses() apenas
useLiveScores  ──interval──> fetchLiveScoresRef.current() ──> fetchLiveScores()
                                                                    |
                                                      Unico ponto de deteccao → som toca 1x
```

As 3 camadas de protecao:
- **Camada 1**: Eliminar o loop duplicado (causa raiz)
- **Camada 2**: `notifiedGoalsRef` Set no useLiveScores (ja implementado - dedup por chave unica)
- **Camada 3**: Debounce de 5s no `playGoalSound` (seguranca extra)
