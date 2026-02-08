

## Parar Requisicoes para Jogos ja Sinalizados (Green/Red)

### Problema

Jogos ao vivo que ja foram sinalizados com resultado (Green ou Red) em todos os metodos continuam fazendo requisicoes a API a cada 120 segundos ate o jogo terminar. Isso desperdia creditos de API desnecessariamente.

### Solucao

Adicionar uma verificacao: se **todos** os metodos do jogo ja tiverem resultado (Green ou Red), desativar o auto-fetch do fixture cache. O jogo ainda mostrara o placar ao vivo (via `useLiveScores` global que ja roda), mas nao buscara mais estatisticas detalhadas (posse, chutes, dominancia, momentum).

### Arquivos a modificar

**1. `src/components/GameListItem.tsx`** (linha 72)
- Verificar se todos os `methodOperations` ja tem resultado
- Se todos tiverem resultado, desativar `autoFetch`

```text
Antes:
  const isLiveForFetch = game.status === 'Live' || game.status === 'Pending';

Depois:
  const allMethodsResolved = game.methodOperations.length > 0 
    && game.methodOperations.every(op => op.result === 'Green' || op.result === 'Red');
  const isLiveForFetch = (game.status === 'Live' || game.status === 'Pending') && !allMethodsResolved;
```

**2. `src/components/GameCardCompact.tsx`** (linha 55)
- Mesma logica: verificar se todos os metodos ja tem resultado
- Passar `autoFetch` como segundo parametro do `useFixtureCache`

```text
Antes:
  const { data: fixtureCache } = useFixtureCache(game.api_fixture_id);

Depois:
  const allMethodsResolved = game.methodOperations.length > 0
    && game.methodOperations.every(op => op.result === 'Green' || op.result === 'Red');
  const isLiveForFetch = (game.status === 'Live' || game.status === 'Pending') && !allMethodsResolved;
  const { data: fixtureCache } = useFixtureCache(game.api_fixture_id, isLiveForFetch);
```

### O que continua funcionando

- O **placar ao vivo** continua atualizando (vem do `useLiveScores` global, nao do fixture cache)
- O **cronometro local** continua contando
- As **notificacoes de gol** continuam funcionando
- Se o usuario **remover** o resultado (ex: desfazer Green), o fetch volta automaticamente

### Economia estimada

Cada jogo sinalizado deixa de fazer ~1 requisicao a cada 120 segundos. Em 90 minutos de jogo, sao ~45 requisicoes economizadas por jogo. Com 10 jogos sinalizados, sao ~450 requisicoes salvas por dia.

