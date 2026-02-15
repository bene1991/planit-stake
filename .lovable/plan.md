

## Corrigir consumo excessivo de creditos da API-Football

### Problema identificado

Os logs mostram que **cada chamada a edge function cria uma nova instancia** ("booted" aparece em cada requisicao). Como o cache e **em memoria**, cada nova instancia comeca com cache vazio, resultando em CACHE MISS e consumo real de credito na API-Football.

Em 2 horas, 637 creditos foram consumidos sem jogos ao vivo. A causa principal sao chamadas paralelas ao endpoint `fixtures?date=2026-02-15` que nunca aproveitam o cache porque cada instancia e independente.

### Causa raiz

1. **Cache em memoria na edge function e inutil** - Supabase edge functions sao efemeras. Cada request pode criar uma nova instancia com cache vazio
2. **`useFixtureSearch.autoLinkGame`** faz chamadas `fixtures?date=...` a cada jogo adicionado, sem deduplicar
3. **`useLiveScores`** continua fazendo polling `fixtures?live=all` mesmo sem jogos ao vivo (verifica `hasGamesToMonitor` que inclui jogos "Pending")
4. **Frontend sem throttle global** - multiplas abas ou componentes podem disparar chamadas simultaneas

### Solucao: Cache persistente no banco de dados

Migrar o cache da edge function de "em memoria" para a tabela `fixture_cache` (ou uma nova tabela dedicada `api_cache`). Assim, todas as instancias compartilham o mesmo cache.

### Alteracoes

**1. Criar tabela `api_cache` no banco (migracao SQL)**

Tabela simples para armazenar respostas cacheadas:

```text
api_cache
  - cache_key (text, PK)
  - response_data (jsonb)
  - created_at (timestamptz)
  - expires_at (timestamptz)
```

Com RLS aberta para leitura autenticada e politica de insert/update para authenticated.

**2. Modificar `supabase/functions/api-football/index.ts`**

- Antes de chamar a API real, consultar `api_cache` no banco: `SELECT response_data FROM api_cache WHERE cache_key = $key AND expires_at > now()`
- Se encontrar, retornar os dados do banco (0 creditos consumidos)
- Se nao encontrar, chamar a API real, salvar no `api_cache` com `expires_at = now() + TTL`, e retornar
- Manter o cache em memoria como camada L1 (rapida) e o banco como L2 (persistente entre instancias)

**3. Otimizar `useLiveScores` para nao fazer polling quando nao ha jogos ao vivo**

- Atualmente `hasGamesToMonitor` retorna true se existem jogos "Pending" (que ainda nao comecaram)
- Mudar para so iniciar polling quando existem jogos "Live" OU quando a hora do jogo "Pending" esta proxima (ex: 30 min antes do inicio)
- Jogos "Pending" com kickoff em mais de 30 minutos nao devem disparar polling

**4. Adicionar deduplicacao no frontend para `fixtures?date=`**

- No `useFixturesByDate`, o `pendingRequest` ref ja deveria evitar chamadas duplicadas, mas cada instancia do hook tem seu proprio ref
- Centralizar numa variavel de modulo para que todas as instancias compartilhem o mesmo promise

### Impacto esperado

- Reducao de ~90% no consumo de creditos quando nao ha jogos ao vivo
- Cache compartilhado entre todas as instancias da edge function
- Polling inteligente: sem jogos ao vivo ou proximos = zero requisicoes

### Detalhes tecnicos

**Arquivos modificados:**
- `supabase/functions/api-football/index.ts` - Adicionar cache L2 via banco de dados
- `src/hooks/useLiveScores.ts` - Restringir polling a jogos realmente ao vivo ou proximos de comecar
- `src/hooks/useApiFootball.ts` - Melhorar deduplicacao global do `useFixturesByDate`
- Nova migracao SQL para criar tabela `api_cache`

