
## Corrigir Estatísticas Travadas nos Tooltips do LDI

### Problema identificado

O hook `useFixtureCache` faz **uma unica chamada** ao `get-fixture-details` quando o componente monta e nunca mais atualiza. O comentario na linha 113 confirma: "Auto-refresh removed to save API credits". Isso faz com que posse de bola, chutes e chutes no gol fiquem congelados no valor do primeiro fetch.

O sistema de live scores (`useLiveScores`) atualiza apenas o placar via `fixtures?live=all`, mas nao busca estatisticas detalhadas.

### Solucao

Adicionar auto-refresh no `useFixtureCache` para jogos ao vivo, reaproveitando o cache de 90 segundos do edge function `get-fixture-details` (que ja existe no backend) para nao desperdicar creditos da API.

### Arquivo a editar

**`src/hooks/useFixtureCache.ts`**

Adicionar um `setInterval` que re-executa `fetchDetails()` a cada **120 segundos** (2 minutos) somente quando:
- `autoFetch` esta ativo (jogos live/pending)
- O status retornado nao e um status de jogo finalizado

O edge function ja tem cache de 90s no backend, entao chamadas frequentes nao geram chamadas extras a API-Football. Com intervalo de 120s no frontend, cada refresh vai pegar dados atualizados (cache expirado) sem excesso de chamadas.

### Detalhes tecnicos

```text
// Dentro de useFixtureCache, apos o useEffect de fetch inicial:

useEffect(() => {
  if (!fixtureId || !autoFetch) return;
  
  // Re-fetch a cada 120s para jogos ao vivo
  const REFRESH_INTERVAL = 120_000;
  const interval = setInterval(() => {
    fetchDetails();
  }, REFRESH_INTERVAL);

  return () => clearInterval(interval);
}, [fixtureId, autoFetch, fetchDetails]);
```

Tambem adicionar logica para parar o intervalo quando o jogo termina (status FT, AET, PEN etc.), checando o `data?.status` retornado.

### Impacto nos creditos da API

- O backend `get-fixture-details` ja tem cache de 90s para jogos ao vivo e cache permanente para jogos finalizados
- Com refresh de 120s no frontend, cada jogo ao vivo gera no maximo ~1 chamada real a API a cada 2 minutos
- Para 1-5 jogos monitorados simultaneamente, isso representa 30-150 chamadas extras por hora, aceitavel dentro do limite de 7500/dia
