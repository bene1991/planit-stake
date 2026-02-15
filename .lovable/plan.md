

## Corrigir notificacao de audio quando jogos comecam

### Problema

O sistema **nunca atualiza o status do jogo para "Live" no banco de dados**. Quando o `useLiveScores` detecta que um jogo apareceu na resposta `fixtures?live=all` (ou seja, ja comecou), ele atualiza apenas o placar visual na tela, mas nao grava `status: 'Live'` no banco.

O `NotificationCenter` depende exatamente dessa transicao de status no objeto `game`:

```text
previousGame.status !== 'Live' && game.status === 'Live'
```

Como o `game.status` no banco permanece "Pending" ou "Not Started" para sempre (ate virar "Finished"), essa condicao nunca e verdadeira, e o audio/voz nunca dispara.

### Solucao

Adicionar no `useLiveScores`, dentro do loop que processa os fixtures ao vivo, a logica para detectar quando um jogo do usuario aparece pela primeira vez como ao vivo e atualizar seu status no banco para "Live".

### Alteracoes

**`src/hooks/useLiveScores.ts`**

Dentro do loop `for (const fixture of fixtures)`, quando um fixture corresponde a um jogo do usuario e o status da API indica que esta ao vivo (1H, 2H, HT, etc.), verificar se o `game.status` no banco ainda e "Pending" ou "Not Started". Se for, fazer um `supabase.update({ status: 'Live' })` nesse jogo - similar ao que ja e feito para "Finished" nas linhas 259-288.

Isso vai:
1. Gravar `status: 'Live'` no banco
2. O `useSupabaseGames` vai recarregar os dados
3. O `NotificationCenter` vai detectar a transicao de status
4. O audio e a voz "Jogo comecando agora!" vao disparar corretamente

Sera adicionado um Set (`livePersistedRef`) para evitar gravar multiplas vezes o mesmo jogo como "Live", identico ao padrao ja usado com `persistedScoresRef` para jogos finalizados.

