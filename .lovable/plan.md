

## Corrigir Som de Gol Duplicado - De Uma Vez Por Todas

### Problema

O som de gol toca duas vezes porque existem **dois caminhos independentes** que disparam o som para o mesmo gol:

1. **Caminho 1**: `useLiveScores` detecta gol -> chama `handleGoalDetected` em DailyPlanning.tsx -> `playGoalSound()` (som 1) + envia push notification
2. **Caminho 2**: A push notification chega no Service Worker -> mostra notificacao do sistema (som do OS) OU usuario clica na notificacao -> `useGoalSoundTrigger` -> `playGoalSound()` (som 2)

Alem disso, o debounce de 5 segundos no `soundManager.ts` pode nao ser suficiente se dois ciclos de polling detectarem o mesmo gol em sequencia rapida.

### Solucao: Centralizar tudo em um unico ponto

**1. `src/pages/DailyPlanning.tsx` - Remover push notification duplicada do handleGoalDetected**

O `handleGoalDetected` faz DUAS coisas que ja sao feitas em outros lugares:
- Toca o som (ok, manter aqui como ponto unico)
- Envia push notification (REMOVER - o som ja tocou, push so serve se o app estiver em background)

Mudar para: so tocar som + highlight. Enviar push notification apenas se a pagina NAO estiver visivel (`document.hidden === true`), pois nesse caso o usuario nao ouviu o som e precisa ser notificado.

**2. `src/sw.ts` - Remover som ao clicar na notificacao de gol**

O Service Worker atualmente adiciona `?goal_alert=true` e envia mensagem `GOAL_NOTIFICATION_CLICKED` quando o usuario clica numa notificacao de gol. Isso causa um SEGUNDO disparo de `playGoalSound()`. Remover essa logica — o clique na notificacao so deve focar a janela, sem tocar som novamente.

**3. `src/hooks/useGoalSoundTrigger.ts` - Remover este hook inteiro**

Este hook existe apenas para ouvir mensagens do SW e query params de gol, ambos removidos no passo anterior. O hook se torna inutilizado.

**4. `src/utils/soundManager.ts` - Aumentar debounce para 15 segundos**

Aumentar `GOAL_SOUND_DEBOUNCE` de 5000ms para 15000ms como seguranca extra contra qualquer caso raro de deteccao duplicada.

**5. `src/hooks/useGoalNotifications.ts` - Remover arquivo**

Este hook nao e importado em nenhuma pagina. E codigo morto que pode causar confusao. Remover.

### Resultado

Apos estas mudancas, existe apenas UM unico caminho para tocar o som de gol:

```text
useLiveScores detecta gol
  -> onGoalDetected callback
    -> handleGoalDetected em DailyPlanning.tsx
      -> playGoalSound() (UNICO ponto)
      -> highlight dourado
      -> push notification (SOMENTE se app em background)
```

### Secao Tecnica

Arquivos modificados:
- `src/pages/DailyPlanning.tsx`: Condicionar push a `document.hidden`, remover import de `useGoalSoundTrigger`
- `src/sw.ts`: Simplificar notificationclick — remover `goal_alert` query param e `GOAL_NOTIFICATION_CLICKED` message
- `src/utils/soundManager.ts`: `GOAL_SOUND_DEBOUNCE` de 5000 para 15000
- `src/hooks/useGoalSoundTrigger.ts`: Deletar arquivo
- `src/hooks/useGoalNotifications.ts`: Deletar arquivo (codigo morto)

