

## Corrigir som de gol duplicado

### Causa raiz

Quando um jogo comeca e o primeiro poll do `useLiveScores` ja detecta um placar (ex: 1-0), duas coisas acontecem simultaneamente:

1. **Deteccao de gol** (`handleGoalDetected` no DailyPlanning) -> toca `playGoalSound()` (som de celebracao)
2. **Transicao para Live** (status persiste no banco -> NotificationCenter detecta `game.status` mudou para "Live") -> toca `playNotificationSound('success')` (som de sucesso) + toast "Jogo AO VIVO"

O usuario ouve dois sons praticamente ao mesmo tempo e percebe como "notificacao dupla de gol".

Alem disso, se o primeiro poll pega o jogo ja com 1-0, o sistema interpreta como gol E inicio de jogo no mesmo instante.

### Solucao

Duas correcoes:

**1. `src/components/NotificationCenter.tsx`** - Suprimir o som do alerta "Jogo AO VIVO"

Quando o jogo vai para Live, a notificacao visual (toast) continua, mas o som sera suprimido se houver gol simultaneo. A forma mais simples: chamar `showNotification` com som desabilitado para o evento de Live, ja que o sistema de gol tem seu proprio som dedicado. Vamos usar a variante sem som para o alerta de Live, mantendo apenas a voz "Jogo comecando agora!" e o toast visual.

Concretamente: ao inves de passar `'success'` como tipo (que toca notification-success.mp3), chamar o toast diretamente sem passar pelo `playNotificationSound`, ou adicionar um parametro `skipSound` ao `showNotification`.

**2. `src/hooks/useLiveScores.ts`** - Nao detectar gol na primeira comparacao quando jogo acaba de comecar

Quando o jogo acabou de ser persistido como Live (esta no `livePersistedRef`), o primeiro poll ja vem com placar. Pular a deteccao de gol nesse primeiro ciclo para evitar que o som de gol e o som de "jogo comecando" toquem juntos. Na proxima iteracao, o `previousScoresRef` ja tera o baseline correto e gols subsequentes serao detectados normalmente.

### Resultado esperado

- Quando um jogo comeca sem gols: apenas toast + voz "Jogo comecando agora!" (sem som extra)
- Quando um gol acontece durante o jogo: apenas som de gol + highlight dourado
- Nunca dois sons ao mesmo tempo para o mesmo evento

