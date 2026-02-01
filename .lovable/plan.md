
## Diagnóstico Completo: Consumo de API-Football

### Problema Principal: Múltiplas Fontes de Consumo Simultâneas

O sistema atual tem **VÁRIAS camadas de refresh rodando em paralelo**, o que explica o esgotamento rápido dos créditos:

| Fonte | Intervalo | Créditos/hora | Localização |
|-------|-----------|---------------|-------------|
| `useLiveScores` (DailyPlanning) | 20s (live) / 120s (idle) | ~180/hora | `DailyPlanning.tsx` linha 4 |
| `useLiveFixtures` (LiveGames) | 30s fixo | ~120/hora | `LiveGames.tsx` linha 28 |
| `useFixtureStatistics` (LiveGames) | 30s fixo | ~120/hora | `LiveGames.tsx` linha 41 |
| `useFixtureEvents` (LiveGames) | 30s fixo | ~120/hora | `LiveGames.tsx` linha 42 |
| `useOptimizedLiveStats` (internamente) | 10 min | ~6/hora | Usado em expandir stats |
| Backfill (jogos finalizados) | 1 por ciclo | ~180/hora | `useLiveScores.ts` linha 276 |

**Total estimado quando páginas estão abertas: ~720+ créditos/hora**

### Pontos Críticos Identificados

1. **LiveGames.tsx faz 3 requests a cada 30s** (linha 28, 41, 42)
   - `live=all` (todos jogos ao vivo)
   - `fixtures/statistics` (estatísticas do jogo selecionado)
   - `fixtures/events` (eventos do jogo selecionado)
   - = 360 créditos/hora só nessa página

2. **DailyPlanning.tsx usa `useLiveScores`** que também chama `live=all`
   - Duplicação com LiveGames se ambas estão abertas

3. **Backfill consome 1 crédito por ciclo** (a cada 20s)
   - Com muitos jogos finalizados sem score = muitos créditos

4. **Intervalo configurável (useRefreshInterval) não é respeitado** por todas as fontes
   - Somente `useLiveScores` usa o intervalo dinâmico
   - `LiveGames.tsx` ignora e usa 30s fixo

---

## Plano de Economia Extrema (SEM CUSTO ADICIONAL)

### Fase 1: Centralizar Requests de Live Games

**Objetivo**: Eliminar duplicação entre `useLiveScores` e `useLiveFixtures`

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LiveGames.tsx` | Usar o cache global do `useLiveScores` em vez de `useLiveFixtures` próprio |
| `src/hooks/useLiveScores.ts` | Exportar todos os fixtures (não só os monitorados) para reuso |

### Fase 2: Desabilitar Auto-fetch de Estatísticas na LiveGames

As estatísticas detalhadas (`statistics` e `events`) consomem 2 créditos por fetch:

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LiveGames.tsx` linha 41-42 | Remover `refetchInterval: 30000` → só buscar sob demanda |

### Fase 3: Aumentar Intervalos e Respeitar Configuração

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LiveGames.tsx` | Usar `useRefreshInterval()` em vez de 30s fixo |
| `src/hooks/useLiveScores.ts` | Aumentar `REFRESH_INTERVAL_ACTIVE` de 20s para 30s |

### Fase 4: Modo de Economia Extrema (Novo)

Criar um **modo de economia** que o usuário pode ativar quando créditos estão baixos:

| Funcionalidade | Comportamento Normal | Modo Economia |
|----------------|---------------------|---------------|
| Refresh de placares | 20-30s | 60s |
| Stats automáticas | Sim | Desabilitado |
| Backfill | 1 por ciclo | Desabilitado |
| LiveGames page | Ativo | Apenas manual |

### Fase 5: Cache Agressivo no Edge Function

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/api-football/index.ts` | Aumentar TTL de `live` de 40s para 60s |

---

## Estimativa de Economia

| Cenário | Antes | Depois | Economia |
|---------|-------|--------|----------|
| DailyPlanning aberto | ~180/hora | ~60/hora | 67% |
| LiveGames aberto | ~360/hora | ~60/hora | 83% |
| Ambos abertos | ~540/hora | ~90/hora | 83% |
| Modo economia | N/A | ~30/hora | 95% |

**Com 7500 créditos:**
- Antes: ~10-14 horas
- Depois (normal): ~80+ horas (3+ dias)
- Depois (economia): ~250 horas (10+ dias)

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/LiveGames.tsx` | Remover auto-refresh de stats/events, usar intervalo configurável |
| `src/hooks/useLiveScores.ts` | Aumentar intervalo mínimo para 30s, adicionar modo economia |
| `src/hooks/useRefreshInterval.ts` | Adicionar opção de 180s (3 min) para economia extrema |
| `supabase/functions/api-football/index.ts` | Aumentar cache de live para 60s |
| `src/components/ApiRequestIndicator.tsx` | Mostrar aviso quando créditos < 1000 |
| `src/components/RefreshIntervalSettings.tsx` | Adicionar toggle de "Modo Economia" |

---

## Nova Opção: Modo Economia

```typescript
// useRefreshInterval.ts - Adicionar modo economia
export const ECONOMY_MODE_KEY = 'vt-economy-mode';

// Quando ativo:
// - Intervalo mínimo = 60s
// - Stats automáticas = desabilitado
// - Backfill = desabilitado (até próximo reset)
```

Interface na página de Conta:
```
☐ Modo Economia (ativa quando créditos < 1000)
  └─ Reduz consumo em 80% desabilitando atualizações automáticas
```

---

## Benefícios

1. **Sem custo adicional** - só otimização de código
2. **Durabilidade extrema** - 7500 créditos duram 3+ dias em uso normal
3. **Controle do usuário** - pode ativar modo economia quando necessário
4. **Cache inteligente** - menos chamadas à API com mesmo resultado
5. **Indicador visual** - aviso quando créditos estão baixos
