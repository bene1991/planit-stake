

## Corrigir som de gol tocando 3 vezes - Solucao DEFINITIVA

### Causa raiz identificada (3 falhas simultaneas)

1. **StrictMode + Refs resetados**: O app usa React StrictMode que desmonta e remonta componentes. Quando isso acontece, `notifiedGoalsRef` (useLiveScores) e `notifiedGoalKeysRef` (DailyPlanning) sao RECRIADOS como Sets vazios, perdendo todo o historico de gols ja notificados. No proximo ciclo de polling, o gol e "detectado" novamente.

2. **Audio lock quebrado**: O check `!activeGoalAudio.paused` falha porque um `new Audio()` comeca com `paused=true`. Entre chamar `play()` e o audio realmente comecar, uma segunda chamada passa pelo lock.

3. **Debounce de 15s insuficiente**: O intervalo de polling e ~20s. Se os refs resetam (StrictMode), o proximo poll apos 20s ultrapassa o debounce de 15s e toca o som novamente.

### Alteracoes

**1. `src/utils/soundManager.ts`** - Tornar `playGoalSound` 100% a prova de falhas

- Trocar o audio lock por um **flag booleano** (`isGoalSoundPlaying = true`) setado ANTES de criar o Audio, impossivel de furar
- Aumentar debounce de 15s para **30s** (maior que qualquer intervalo de polling)
- Adicionar dedup por **chave de gol** no proprio soundManager usando sessionStorage (ultima linha de defesa independente de React)

**2. `src/hooks/useLiveScores.ts`** - Mover dedup para nivel de modulo

- Mover `notifiedGoalsRef` de `useRef` para variavel de **modulo** (fora do componente), para sobreviver a remontagens do StrictMode
- Adicionar limpeza automatica de chaves com mais de 2 horas (evitar memory leak)

**3. `src/pages/DailyPlanning.tsx`** - Mover dedup para sessionStorage

- Trocar `notifiedGoalKeysRef` (useRef) por **sessionStorage** (`notifiedGoalKeys`)
- Sobrevive a remontagens, HMR e re-renders

### Resultado esperado

Quatro camadas de protecao, TODAS independentes de ciclo de vida React:

```text
Camada 1: notifiedGoals (variavel de modulo em useLiveScores)
   -> Bloqueia callback duplicado por fixture+team+score

Camada 2: notifiedGoalKeys (sessionStorage em DailyPlanning)
   -> Bloqueia playGoalSound() por gameId+score

Camada 3: isGoalSoundPlaying (flag booleano em soundManager)
   -> Bloqueia audio concorrente

Camada 4: debounce 30s + sessionStorage (soundManager)
   -> Bloqueia qualquer chamada dentro de 30s da anterior
```

Nenhuma dessas camadas depende de `useRef`, entao remontagens do React nao afetam nada.

