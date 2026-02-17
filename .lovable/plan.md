
## Corrigir som de gol tocando duas vezes - Solucao definitiva

### Problemas encontrados

1. **Bug no `goalDetectedAt`**: O `previousScoresRef` e atualizado na linha 238, mas lido novamente nas linhas 242-245, fazendo com que `goalJustHappened` seja SEMPRE `false`.
2. **Sem dedup no `handleGoalDetected`**: Se o hook `useLiveScores` for recriado (remontagem do componente), o `notifiedGoalsRef` reseta e gols ja detectados podem disparar novamente.
3. **Debounce fragil no `playGoalSound`**: O debounce de 15s usa variavel de modulo que pode ser perdida em HMR ou re-avaliacao do modulo.

### Alteracoes

**1. `src/hooks/useLiveScores.ts`** - Corrigir `goalDetectedAt` e fortalecer dedup

- Salvar o snapshot anterior ANTES de atualizar o `previousScoresRef` (mover a leitura das linhas 242-245 para antes da linha 238)
- Adicionar timestamp ao `notifiedGoalsRef` para permitir limpeza periodica (evitar memory leak)

**2. `src/pages/DailyPlanning.tsx`** - Adicionar dedup proprio no `handleGoalDetected`

- Criar um `notifiedGoalKeysRef` no DailyPlanning com chaves tipo `${gameId}-${homeScore}-${awayScore}`
- Verificar se o gol ja foi notificado ANTES de chamar `playGoalSound()`
- Isso cria uma segunda camada de protecao independente do `useLiveScores`

**3. `src/utils/soundManager.ts`** - Tornar `playGoalSound` a prova de balas

- Usar uma referencia ao objeto `Audio` ativo para impedir que um segundo audio seja criado enquanto o primeiro ainda esta tocando
- Manter o debounce de 15s como protecao adicional
- Guardar `lastGoalSoundTime` no `sessionStorage` alem da variavel de modulo (sobrevive a HMR)

### Resultado esperado

Triple dedup:
1. `notifiedGoalsRef` no `useLiveScores` (chave por fixture+team+score)
2. `notifiedGoalKeysRef` no `DailyPlanning` (chave por game+score)
3. `playGoalSound` com lock de audio ativo + debounce 15s + sessionStorage backup

Isso garante que, mesmo que qualquer camada falhe, as outras impedem o som duplicado.
