

## Modo Maratona: Creditos Durando o Dia Todo

### Problema Atual

Existem dois problemas de consumo:

1. **`useLiveScores` ignora o intervalo configuravel** - O hook usa 20s hardcoded (`REFRESH_INTERVAL_ACTIVE = 20 * 1000`), mesmo que o usuario configure 60s ou 120s nas configuracoes. A configuracao do `useRefreshInterval` so e usada no `useAutoRefresh` do countdown visual.

2. **`useFixtureCache` faz 1 chamada/minuto POR jogo ao vivo** - Com 10 jogos ao vivo, sao 600 creditos/hora so de detalhes.

### Estimativa de Consumo Atual (dia de muitos jogos, ~16h)

| Fonte | Calculo | Creditos |
|-------|---------|----------|
| `useLiveScores` (live=all, 20s) | 3/min x 960min | ~2880 |
| `useFixtureCache` (10 jogos medios ao vivo) | 10/min x 960min | ~9600 |
| Backfills | ~50 jogos | ~50 |
| **TOTAL** | | **~12.530** |

Limite diario: **7.500 creditos**. Nao sobrevive nem 10 horas.

### Solucao: 3 Otimizacoes

#### 1. Conectar `useLiveScores` ao intervalo configuravel

**Arquivo:** `src/hooks/useLiveScores.ts`

Aceitar o intervalo do usuario como parametro e usar no lugar do hardcoded 20s:

```
export function useLiveScores(
  games: Game[],
  onScorePersisted?: ...,
  onGoalDetected?: ...,
  activeIntervalMs?: number   // NOVO
)
```

O `REFRESH_INTERVAL_ACTIVE` sera substituido por `activeIntervalMs` (default 30000 se nao informado).

**Arquivo:** `src/pages/DailyPlanning.tsx`

Passar o `intervalMs` do `useRefreshInterval` para o `useLiveScores`:

```
const { intervalMs } = useRefreshInterval();
const { ... } = useLiveScores(games, handleScorePersisted, handleGoalDetected, intervalMs);
```

#### 2. Desabilitar auto-refresh do `useFixtureCache` para jogos ao vivo

O `useFixtureCache` ja busca dados iniciais para jogos ao vivo (isso e necessario para o LDI). Mas o auto-refresh de 60s e redundante porque o `useLiveScores` ja atualiza os placares centralizadamente.

**Arquivo:** `src/hooks/useFixtureCache.ts`

Remover o `setInterval` de auto-refresh (linhas do `LIVE_REFRESH_INTERVAL`). Os dados de dominancia serao atualizados apenas quando o usuario expandir o card manualmente ou quando o cache invalidar naturalmente.

Isso elimina ~600 creditos/hora com 10 jogos simultaneos.

#### 3. Modo Auto-Economia baseado em creditos restantes

**Arquivo:** `src/hooks/useLiveScores.ts`

Ler os creditos restantes do `_rateLimit` que ja vem na resposta da API e ajustar automaticamente:

```
Creditos > 5000: intervalo normal do usuario
Creditos 2000-5000: minimo 60s (ignora configuracoes menores)
Creditos 500-2000: forca 120s
Creditos < 500: forca 300s (5 min) + log de alerta
```

Isso sera um "piso" que so entra em acao quando os creditos ficam baixos, sem interferir no uso normal.

### Estimativa Apos Otimizacoes (intervalo 60s, 16h)

| Fonte | Calculo | Creditos |
|-------|---------|----------|
| `useLiveScores` (live=all, 60s) | 1/min x 960min | ~960 |
| `useFixtureCache` (sem auto-refresh) | ~50 buscas iniciais | ~150 |
| Backfills | ~50 jogos | ~50 |
| Auto-economia (ultimas horas) | Reducao extra | -100 |
| **TOTAL** | | **~1.060** |

Com margem enorme! Mesmo com 30s configurado: ~1.970 creditos. Sobra para o dia todo.

### Arquivos a Editar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useLiveScores.ts` | Aceitar `activeIntervalMs`, implementar auto-economia por creditos |
| `src/hooks/useFixtureCache.ts` | Remover auto-refresh por intervalo (manter fetch inicial + `refetch` manual) |
| `src/pages/DailyPlanning.tsx` | Passar `intervalMs` para `useLiveScores` |

### Ordem de Implementacao

1. Editar `useLiveScores.ts` - aceitar intervalo e auto-economia
2. Editar `useFixtureCache.ts` - remover auto-refresh
3. Editar `DailyPlanning.tsx` - conectar intervalo configuravel

