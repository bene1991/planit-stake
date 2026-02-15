

## Adicionar alertas de cartao vermelho

### Como funciona hoje

- O sistema ja recebe dados de cartoes vermelhos via `get-fixture-details` (campo `key_events` com `type: 'red_card'`), que e buscado por cada GameCard ao vivo
- Porem, nao existe nenhuma logica para **detectar quando um novo cartao vermelho aparece** e disparar notificacao/som

### Solucao

Adicionar deteccao de cartao vermelho no componente `GameListItem` (onde o `useFixtureCache` ja e usado) e no `DailyPlanning` com um callback dedicado, similar ao sistema de gols.

### Alteracoes

**1. `src/hooks/useLiveScores.ts`** - Adicionar callback `onRedCardDetected`

- Criar nova interface `RedCardDetectedCallback` similar a `GoalDetectedCallback`
- Aceitar novo parametro opcional `onRedCardDetected`
- No entanto, como `fixtures?live=all` nao retorna eventos individuais (cartoes), a deteccao sera feita no nivel do `useFixtureCache`

**2. `src/hooks/useFixtureCache.ts`** - Adicionar deteccao de cartao vermelho

- Adicionar um `previousRedCardsRef` (Set) para rastrear cartoes ja notificados
- Quando `key_events` muda e contem novos eventos `type: 'red_card'` que nao estavam no snapshot anterior, disparar um callback `onRedCardDetected`
- Expor o callback como parametro opcional do hook

**3. `src/components/GameListItem.tsx`** - Propagar callback de cartao vermelho

- Aceitar prop `onRedCardDetected` e passar ao `useFixtureCache` ou detectar localmente comparando `key_events` com snapshot anterior

**4. `src/pages/DailyPlanning.tsx`** - Handler de cartao vermelho

- Criar `handleRedCardDetected` similar ao `handleGoalDetected`
- Disparar notificacao visual (toast vermelho) com mensagem: "Cartao Vermelho! [Jogador] - [Time] ([Minuto]')"
- Disparar som de alerta (usar `playNotificationSound('error')` que ja existe)
- Enviar push notification se app estiver em background
- Enviar para Telegram se habilitado

**5. `src/utils/soundManager.ts`** - Adicionar funcao de voz para cartao vermelho

- Criar `playRedCardVoice()` que usa Web Speech API para falar "Cartao vermelho!" em pt-BR
- Com debounce de 30 segundos (mesmo padrao do `playGameStartVoice`)

**6. `src/hooks/useNotifications.ts`** - Adicionar preferencia `redCardAlerts`

- Novo campo `redCardAlerts: boolean` (default: `true`) nas preferencias
- Permite ao usuario desativar alertas de cartao vermelho independentemente

### Fluxo de deteccao

```text
get-fixture-details (edge function)
  -> retorna key_events com type: 'red_card'
    -> useFixtureCache detecta novo red_card vs snapshot anterior
      -> callback onRedCardDetected dispara
        -> DailyPlanning recebe e:
           1. Toast vermelho com nome do jogador e time
           2. Som de alerta (notification-error)
           3. Voz "Cartao vermelho!" (se voiceAlerts habilitado)
           4. Push notification (se app em background)
           5. Telegram (se habilitado)
```

### Impacto no consumo de API

Zero impacto adicional - os dados de `key_events` ja sao buscados pelo `useFixtureCache` que cada GameCard ao vivo utiliza. A deteccao e puramente frontend, comparando snapshots.

