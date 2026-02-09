

## Atualizar Informativo de Gol Imediatamente Apos Deteccao

### Problema

Quando um gol acontece, o placar atualiza rapido (via `live=all` a cada 60s), mas o **informativo de gol** (nome do jogador que marcou + minuto) demora ate 3.5 minutos para aparecer. Isso acontece porque:

1. `useLiveScores` detecta o gol via `live=all` (so tem placar, sem eventos detalhados)
2. `useFixtureCache` busca detalhes completos (eventos, jogadores) a cada **120 segundos**
3. O backend `get-fixture-details` tem cache de **90 segundos**

Total: ate 120 + 90 = **210 segundos** de atraso nos detalhes do gol.

### Solucao

Quando `useLiveScores` detecta um gol, forcar `useFixtureCache` a buscar dados frescos imediatamente, sem esperar o ciclo normal de 120s.

### Etapas

**1. `src/hooks/useFixtureCache.ts` - Aceitar sinal de invalidacao**

Adicionar um parametro `invalidateSignal` (numero/timestamp) que, quando muda, forca um refetch imediato. Tambem passar um parametro `skipCache` na chamada ao edge function para que o backend ignore o cache de 90s.

**2. `supabase/functions/get-fixture-details/index.ts` - Suportar `skip_cache`**

Adicionar parametro `skip_cache` na requisicao. Quando verdadeiro, ignora o cache de 90s e busca dados frescos da API, garantindo que os eventos do gol recem-marcado sejam retornados.

**3. `src/components/GameCardCompact.tsx` - Passar sinal de gol para o cache**

Usar o `liveScore` (que ja tem o placar atualizado) para detectar mudanca de placar e gerar um sinal de invalidacao que forca o `useFixtureCache` a refazer a busca.

**4. `src/hooks/useLiveScores.ts` - Incluir flag de gol recente no LiveScore**

Adicionar campo `goalDetectedAt` no objeto `LiveScore`. Quando um gol e detectado, setar com `Date.now()`. O `GameCardCompact` usa isso como sinal de invalidacao.

### Resultado

Apos o gol ser detectado pelo polling, os detalhes (jogador + minuto) aparecem em **2-5 segundos** ao inves de ate 3.5 minutos.

### Secao Tecnica

Arquivos modificados:
- `src/hooks/useLiveScores.ts`: Adicionar `goalDetectedAt` ao `LiveScore`
- `src/hooks/useFixtureCache.ts`: Aceitar `invalidateSignal`, passar `skip_cache` ao edge function
- `supabase/functions/get-fixture-details/index.ts`: Suportar `skip_cache` no body
- `src/components/GameCardCompact.tsx`: Conectar `liveScore.goalDetectedAt` ao `useFixtureCache` como sinal de invalidacao

