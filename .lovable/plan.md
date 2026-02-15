

## Corrigir Consumo Excessivo de Creditos - Raiz do Problema

### Diagnostico

Os logs mostram claramente o problema: **a edge function `get-fixture-details` esta sendo chamada em massa** (10+ instancias simultaneas), enquanto `useLiveScores` continua fazendo polling mesmo recebendo erros de "rate limit exceeded".

Os logs mostram:
- `get-fixture-details` com **13 boots simultaneos** numa unica rodada, cada um buscando um fixture individual
- `useLiveScores` fazendo polling a cada 120s e recebendo "rateLimit: Too many requests" repetidamente
- Nenhum backoff quando recebe erro de rate limit

### Causas Raiz

| Causa | Impacto | Onde |
|-------|---------|------|
| **`get-fixture-details` chamada por CADA GameCard** | N jogos ao vivo = N chamadas a cada 120s | `useFixtureCache` dentro de `GameCardCompact` e `GameListItem` |
| **Sem backoff em rate limit** | Continua consumindo creditos mesmo quando a API rejeita | `useLiveScores` e `useFixtureCache` |
| **`get-fixture-details` nao usa o cache L2** | Cada instancia efemera e um CACHE MISS | `supabase/functions/get-fixture-details/index.ts` |
| **Retry automatico em erro** | Cada falha gera +2 retries (3x o consumo) | `useFixtureCache` linhas 92-97 |

### Plano de Correcao

**1. Adicionar backoff exponencial em `useLiveScores` quando recebe rate limit**

Quando a resposta contem erro de "rateLimit", parar o polling por 5 minutos e mostrar aviso ao usuario. Atualmente o codigo simplesmente seta o erro e continua no proximo ciclo.

Arquivo: `src/hooks/useLiveScores.ts`

- Detectar `data?.errors?.rateLimit` na resposta
- Quando detectado, setar um `rateLimitedUntilRef` com timestamp de 5 minutos no futuro
- No inicio de `fetchLiveScores`, checar se ainda esta em periodo de backoff e pular

**2. Adicionar backoff em `useFixtureCache` quando recebe erro**

Arquivo: `src/hooks/useFixtureCache.ts`

- Remover o retry automatico (linhas 92-97) que triplica o consumo em erros
- Quando recebe erro, esperar ate o proximo ciclo natural de 120s ao inves de retentar imediatamente

**3. Integrar `get-fixture-details` com o cache L2 (`api_cache`)**

A edge function `get-fixture-details` tem seu proprio cache em `fixture_cache`, mas cada instancia efemera cria uma nova instancia do Supabase client. O problema e que ela faz chamadas individuais a API-Football para cada fixture.

Arquivo: `supabase/functions/get-fixture-details/index.ts`

- Verificar se ja usa o cache do banco (`fixture_cache`) antes de chamar a API
- Adicionar verificacao de rate limit antes de fazer chamadas a API real
- Se receber rate limit error, retornar dados cacheados mesmo que expirados (stale-while-revalidate)

**4. Limitar chamadas paralelas de `get-fixture-details` no frontend**

Arquivo: `src/hooks/useFixtureCache.ts`

- Adicionar deduplicacao global (module-level Map) similar ao que foi feito no `useApiFootball`
- Evitar que 13 GameCards disparem 13 chamadas simultaneas

### Impacto Esperado

- Eliminacao de chamadas duplicadas paralelas (-80% de requests do `get-fixture-details`)
- Backoff de 5 minutos quando atinge rate limit (para de consumir creditos inutilmente)
- Sem retries automaticos em erro (cada erro gasta 1 credito ao inves de 3)

### Detalhes Tecnicos

**Arquivos modificados:**
- `src/hooks/useLiveScores.ts` - Adicionar backoff em rate limit
- `src/hooks/useFixtureCache.ts` - Remover retries, adicionar deduplicacao global
- `supabase/functions/get-fixture-details/index.ts` - Stale-while-revalidate em rate limit

