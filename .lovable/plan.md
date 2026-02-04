

## Diagnóstico: Consumo Excessivo de API (1069 créditos)

### Problemas Identificados

O sistema está fazendo chamadas à API de **MÚLTIPLOS lugares simultaneamente**, resultando em consumo exponencial:

| Fonte | Intervalo | Créditos/Hora | Multiplicador |
|-------|-----------|---------------|---------------|
| `useLiveScores` (DailyPlanning) | 20s | ~180 | x1 por jogo Live |
| `useLiveFixtures` (LiveGames) | 30s | ~120 | Global |
| `useFixture` (MyLiveGames - cada card) | 60s | ~60 | **x N jogos** |
| `useFixtureStatistics` (MyLiveGames) | 30s | ~120 | Jogo selecionado |
| `useFixtureEvents` (LiveGames) | 30s | ~120 | Jogo selecionado |
| Backfill de jogos finalizados | On-demand | ~10-50 | Variável |

**Exemplo com 5 jogos vinculados:**
- LiveGames: 120 + 120 + 120 = 360/hora
- MyLiveGames cards: 60 x 5 = 300/hora  
- DailyPlanning: 180/hora
- **Total: ~840/hora** (mais backfill e buscas)

**Em 1.5 horas = ~1260 créditos** (explica os 1069)

---

### Solução: Centralização + Cache Inteligente

#### 1. Desabilitar auto-refresh em páginas que não estão visíveis

```typescript
// Usar Page Visibility API para pausar refresh quando aba não está visível
const isPageVisible = usePageVisibility();
const shouldFetch = isPageVisible && hasActiveGames;
```

#### 2. Eliminar chamadas individuais por jogo no MyLiveGames

Atualmente cada `GameCard` faz sua própria chamada `useFixture()` a cada 60s.
Com 10 jogos = 10 chamadas/minuto = 600/hora APENAS para cards!

**Solução:** Usar o cache global de `useLiveScores` para todos os cards.

#### 3. Desabilitar auto-refresh na página "Todos os Jogos"

A aba "Todos" (LiveGames) faz `useLiveFixtures(30000)` + stats + events constantemente.
Mudar para **refresh manual apenas**.

#### 4. Unificar fonte de dados

Criar um **contexto global** `LiveScoresContext` que:
- Faz UMA chamada `live=all` a cada 30-60s
- Distribui dados para todos os componentes
- Pausa quando página não está visível

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/usePageVisibility.ts` | **CRIAR** - Hook para detectar visibilidade da aba |
| `src/hooks/useLiveScores.ts` | Adicionar pausa quando página não está visível |
| `src/pages/LiveGames.tsx` | Desabilitar auto-refresh, usar refresh manual |
| `src/components/LiveStats/MyLiveGames.tsx` | Remover `useFixture` individual dos cards, usar cache global |
| `src/hooks/useApiFootball.ts` | Aumentar intervalo padrão para 60s |

---

### Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Página aberta, 5 jogos | ~840/hora | ~60/hora |
| Página minimizada | ~840/hora | **0/hora** |
| Navegando entre páginas | Acumula | Pausa automática |

**Economia estimada:** 90-95% de redução no consumo de créditos

---

### Detalhes da Implementação

#### Hook usePageVisibility

```typescript
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  
  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
  
  return isVisible;
}
```

#### Modificação no useLiveScores

```typescript
// Adicionar verificação de visibilidade
const isPageVisible = usePageVisibility();

useEffect(() => {
  if (!isPageVisible || !hasGamesToMonitor) {
    // Pausar quando página não está visível
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return;
  }
  // ... resto do código
}, [isPageVisible, hasGamesToMonitor, ...]);
```

#### Remoção de chamadas individuais no MyLiveGames

```typescript
// ANTES: Cada card fazia sua própria chamada
function GameCard({ game }) {
  const { data: fixtureData } = useFixture(game.api_fixture_id, 60000); // ❌
}

// DEPOIS: Usar dados do cache global
function GameCard({ game, liveScores }) {
  const score = liveScores.get(game.api_fixture_id); // ✅
}
```

---

### Ordem de Implementação

1. Criar hook `usePageVisibility`
2. Integrar visibilidade no `useLiveScores` para pausar refresh
3. Remover auto-refresh de 30s no `LiveGames.tsx`
4. Refatorar `MyLiveGames` para usar cache global ao invés de chamadas individuais
5. Aumentar intervalo padrão de 30s para 60s

