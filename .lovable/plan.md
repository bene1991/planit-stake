
## Plano: Correção do Contador de Requisições API

### Problema Identificado

O contador no site mostra **0/7.5k** enquanto a API-Football registra **97 requisições** porque as principais funções que fazem chamadas à API **não estão chamando `trackRequest()`**.

### Análise Detalhada

| Hook/Componente | Chama `trackRequest`? | Frequência |
|-----------------|----------------------|------------|
| `useLiveScores.ts` | **NÃO** | A cada 20s (principal consumidor) |
| `useApiFootball.ts` | **NÃO** | A cada 30s (página LiveGames) |
| `useFixtureOdds.ts` | **NÃO** | Sob demanda |
| `useFixtureSearch.ts` | **NÃO** | Sob demanda |
| `useGoalPersistence.ts` | SIM | Jogos finalizados |
| `useOptimizedLiveStats.ts` | SIM | Stats detalhadas |

A maioria das requisições vem de `useLiveScores` e `useApiFootball`, que **não rastreiam** o consumo.

---

### Solução: Centralizar Tracking na Edge Function

Em vez de adicionar `trackRequest` em cada hook (difícil de manter), a solução ideal é **retornar o consumo real da API-Football** diretamente pela Edge Function.

A API-Football retorna headers com informações de quota:
- `x-ratelimit-requests-limit`: limite diário
- `x-ratelimit-requests-remaining`: requisições restantes

#### Opção 1: Tracking na Edge Function (Recomendado)

Modificar `api-football/index.ts` para retornar os headers de rate limit:

```typescript
// Adicionar ao response da edge function
const rateLimitData = {
  limit: response.headers.get('x-ratelimit-requests-limit'),
  remaining: response.headers.get('x-ratelimit-requests-remaining'),
  used: limit ? limit - remaining : null
};

return new Response(
  JSON.stringify({ ...data, _rateLimit: rateLimitData }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

Então o frontend lê `_rateLimit.remaining` do response e atualiza o contador.

#### Opção 2: Adicionar `trackRequest` em todos os hooks

Modificar cada hook que chama a API para incluir tracking:

**`useLiveScores.ts`** - Adicionar:
```typescript
import { useApiRequestTracker } from './useApiRequestTracker';
// ...
const { trackRequest } = useApiRequestTracker();
// Após cada chamada bem-sucedida:
trackRequest(1); // live=all
trackRequest(1); // backfill
```

**`useApiFootball.ts`** - Adicionar:
```typescript
import { useApiRequestTracker } from './useApiRequestTracker';
// ...
// Dentro de useApiFootball:
const { trackRequest } = useApiRequestTracker();
// Após fetchData bem-sucedido:
trackRequest(1);
```

---

### Solução Recomendada: Combinar Ambas

1. **Edge Function** retorna dados de rate limit da API real
2. **Frontend** usa esses dados para exibir o consumo real
3. Como fallback, manter `trackRequest` local para estimativa quando offline

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/api-football/index.ts` | Extrair e retornar headers de rate limit |
| `src/hooks/useApiRequestTracker.ts` | Adicionar `setFromApi(remaining)` para sincronizar com dados reais |
| `src/hooks/useLiveScores.ts` | Ler `_rateLimit` do response e sincronizar contador |
| `src/hooks/useApiFootball.ts` | Ler `_rateLimit` do response e sincronizar contador |
| `src/components/ApiRequestIndicator.tsx` | Mostrar aviso se dados são estimados vs. reais |

---

### Mudanças Específicas

#### 1. Edge Function (`api-football/index.ts`)

```typescript
// Extrair headers de rate limit
const limit = parseInt(response.headers.get('x-ratelimit-requests-limit') || '0', 10);
const remaining = parseInt(response.headers.get('x-ratelimit-requests-remaining') || '0', 10);

// Log para debug
console.log(`[RATE LIMIT] Used: ${limit - remaining}/${limit}, Remaining: ${remaining}`);

// Incluir no response
return new Response(
  JSON.stringify({ 
    ...data, 
    _rateLimit: { 
      limit, 
      remaining, 
      used: limit - remaining 
    } 
  }),
  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
);
```

#### 2. Hook `useApiRequestTracker.ts`

```typescript
// Adicionar função para sincronizar com API real
const syncFromApi = useCallback((used: number, limit: number) => {
  if (used > 0 && limit > 0) {
    setRequestCount(used);
    saveCount(used);
    // Atualizar limite se diferente
    if (limit !== DAILY_LIMIT) {
      console.log(`[Tracker] API limit: ${limit}, local: ${DAILY_LIMIT}`);
    }
  }
}, [saveCount]);

return {
  // ... existente
  syncFromApi,
};
```

#### 3. Hook `useLiveScores.ts`

```typescript
// Após receber response da API:
if (data?._rateLimit?.used) {
  // Emitir evento global para sincronizar contador
  window.dispatchEvent(new CustomEvent('api-usage-update', {
    detail: { used: data._rateLimit.used, limit: data._rateLimit.limit }
  }));
}
```

---

### Benefícios

1. **Contador preciso** - Sincronizado com dados reais da API
2. **Não depende de localStorage** - Dados vêm do servidor
3. **Funciona em múltiplos dispositivos** - Mesmo valor para todos
4. **Debug facilitado** - Logs na edge function mostram consumo real
5. **Retrocompatível** - Fallback para estimativa local se API não retornar dados

---

### Fluxo de Dados

```
Edge Function
     │
     ▼ (extrai x-ratelimit headers)
  Response com _rateLimit
     │
     ▼ (useLiveScores lê _rateLimit)
  Emite evento 'api-usage-update'
     │
     ▼ (useApiRequestTracker escuta evento)
  Atualiza contador e localStorage
     │
     ▼ (ApiRequestIndicator re-renderiza)
  UI mostra valor correto: 97/7.5k
```

---

### Ordem de Implementação

1. Modificar Edge Function para extrair e retornar rate limit
2. Atualizar `useApiRequestTracker` para aceitar dados da API
3. Modificar `useLiveScores` para emitir eventos de uso
4. Modificar `useApiFootball` para emitir eventos de uso
5. Testar sincronização do contador
