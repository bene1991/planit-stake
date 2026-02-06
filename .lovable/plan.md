

## Otimizacao: Limitar Busca de Dados para Jogos Finalizados

### Problema

Com a mudanca anterior (remover `isLive &&`), todos os jogos com `api_fixture_id` na lista agora disparam `useFixtureCache`, que chama a edge function `get-fixture-details`.

- **Jogos ja cacheados:** Impacto minimo (apenas chamada a edge function, sem consumo de API-Football)
- **Jogos nunca buscados:** 3 creditos da API-Football por jogo (fixture + stats + events)
- **Risco real:** Se o usuario tem 50+ jogos finalizados na lista e nenhum esta no cache, sao 150+ creditos consumidos de uma vez

### Solucao Proposta

Mostrar o `DominanceIndicator` para jogos finalizados **apenas se ja houver dados no cache**, sem disparar novas buscas para jogos antigos que nunca foram monitorados ao vivo.

### Abordagem Tecnica

#### Opcao: Fetch condicional no `useFixtureCache`

Adicionar um parametro `fetchOnMount` ao hook `useFixtureCache`:

- `fetchOnMount: true` (padrao para jogos ao vivo) - Busca dados imediatamente ao montar
- `fetchOnMount: false` (para jogos finalizados) - Nao busca automaticamente, so mostra se ja tiver cache

#### Arquivo a editar: `src/hooks/useFixtureCache.ts`

Adicionar parametro opcional `autoFetch`:

```
function useFixtureCache(
  fixtureId: number | string | null | undefined,
  autoFetch: boolean = true  // novo parametro
): UseFixtureCacheResult
```

Quando `autoFetch = false`:
- Nao dispara `fetchDetails()` no `useEffect` inicial
- Nao configura auto-refresh
- Retorna `{ data: null, loading: false, error: null, refetch }`
- O usuario pode clicar para carregar manualmente via `refetch()`

#### Arquivo a editar: `src/components/GameListItem.tsx`

Passar `autoFetch` baseado no status do jogo:

```
const isLive = game.status === 'Live';
const fixtureCache = useFixtureCache(
  game.api_fixture_id,
  isLive  // so busca automaticamente se estiver ao vivo
);
```

Para jogos finalizados:
- Se ja tiver cache (buscado enquanto estava ao vivo): mostra o indicador normalmente
- Se nao tiver cache: nao mostra nada (sem custo)
- Opcionalmente: adicionar botao "Carregar analise" para buscar sob demanda

### Resultado

- **Jogos ao vivo:** Comportamento identico ao atual (busca automatica + refresh)
- **Jogos finalizados com cache:** Mostra a analise pos-jogo sem custo adicional
- **Jogos finalizados sem cache:** Nao consome creditos desnecessariamente
- **Creditos API:** Zero impacto adicional comparado ao comportamento original

