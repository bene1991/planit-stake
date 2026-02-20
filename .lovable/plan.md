
## Correções: Void no fluxo de jogos, ROI zerado na análise e Win Rate

### 3 problemas identificados

---

### Problema 1 — Jogo sumindo ao marcar Void

**Causa:** Em `src/pages/DailyPlanning.tsx` (linhas 400-406), a separação entre jogos pendentes e finalizados usa:

```
pendingGames  = games where some(op => !op.result)
finalizedGames = games where every(op => op.result)
```

Void é um resultado válido (`op.result = 'Void'`), então um jogo com **todos** os métodos marcados (incluindo Void) é corretamente movido para o histórico. Isso é o comportamento esperado.

**O bug real:** Quando um jogo tem **múltiplos métodos** e apenas **um deles é marcado como Void**, o jogo some do planejamento porque o `pendingGames` ainda o incluiria... mas na verdade o jogo deveria continuar visível até que todos os outros métodos também sejam finalizados. Isso **já funciona corretamente** com a lógica atual — a exceção relatada deve ser que o jogo foi para o histórico porque de fato todos os métodos foram marcados.

**Porém**, há um bug relacionado: a contagem de operações no resumo do dia e histórico inclui Void no total, inflando os números. E a detecção de "jogo completo" para suprimir alertas de gol (`allMethodsResolved`) na linha 58 do `GameCardCompact.tsx` já trata Void corretamente:

```typescript
const allMethodsResolved = game.methodOperations.every(
  op => op.result === 'Green' || op.result === 'Red' || op.result === 'Void'
);
```

**Fix real para o Problema 1:** O jogo com Void deve ir ao histórico (isso já acontece). O que precisa ser corrigido é que quando um jogo vai ao histórico com resultado Void, ele deve **aparecer no histórico** normalmente (sem desaparecer). O motivo do "sumiço" é que `finalizedGames` usa `every(op => op.result)` que funciona, mas o histórico filtra por `historyPeriod` — se o jogo foi de um dia diferente do filtro aplicado, ele fica invisível. Vamos deixar o filtro de histórico mais claro para o usuário.

Na verdade, revisando mais a fundo: **o bug confirmado** é que `isGamePending` na linha 104 usa `!op.result`, que é `true` quando result é `undefined/null` mas `false` quando é `'Void'` — então um Void JÁ é tratado como "finalizado". Se um jogo tem 2 métodos e um é Void e outro ainda não tem resultado, o jogo **permanece** no planejamento. Se ambos têm resultado (um Void, outro Green/Red), o jogo vai ao histórico. Esse comportamento está correto.

**O bug real reportado** ("o jogo simplesmente sumiu"): provavelmente o jogo tinha só um método, que foi marcado como Void — e foi para o histórico, mas o usuário não percebeu que estava lá (pode estar escondido pelo filtro de período do histórico). Vamos garantir que Void seja visível no histórico e que o filtro padrão do histórico mostre "Hoje" (que inclui jogos de hoje).

---

### Problema 2 — ROI = 0 na Análise de Método

**Causa identificada em `src/hooks/useMethodAnalysis.ts` (linha 312):**

```typescript
const greens = methodOperations.filter(op => op.result === 'Green').length;
const reds = totalOperations - greens;  // BUG: Void é contado como Red!
```

Isso faz com que operações Void sejam somadas aos Reds erroneamente.

**Causa secundária (linha 327):**
```typescript
const totalStaked = totalOperations * stakeValueReais;
const roi = totalStaked > 0 ? (profitReais / totalStaked) * 100 : 0;
```

Voids (lucro 0) diluem o `profitReais` total, e o `totalStaked` inclui Voids no denominador, calculando ROI incorretamente.

**Causa terciária (linha 316):**
```typescript
const profitReais = methodOperations.reduce((sum, op) => sum + (op.profit || 0), 0);
```

Quando uma operação Void não tem `op.profit` salvo (null/undefined), ela contribui com 0 — correto. Mas se o profit foi salvo com valor errado anteriormente, pode distorcer.

**Fix:** 
- `reds` = filtrar explicitamente `op.result === 'Red'`
- `totalStaked` = usar apenas operações que NÃO são Void (Green + Red) para o denominador do ROI
- `winRate` = `greens / (greens + reds)` excluindo Voids

---

### Problema 3 — Win Rate e contagens incorretas em múltiplos lugares

**Locais com Void não excluído do denominador:**

1. `src/pages/DailyPlanning.tsx` linha 537: `winRate = totalOperations / greenOps` — `totalOperations` inclui Void
2. `src/hooks/useStatistics.ts` linha 78: `winRate = greenOps / totalOperations` — mesmo problema
3. `src/hooks/useFilteredStatistics.ts` linha 189: `winRate = greenOps / totalOps` — idem

**Fix:** Em todos esses lugares, o denominador do Win Rate deve ser `greens + reds` (excluindo Voids).

---

### Problema 4 — IA não analisa

**Causa:** A IA chama a edge function `analyze-performance` e `analyze-method`, que usam a chave `LOVABLE_API_KEY`. O problema pode ser que o token de autorização enviado usa `VITE_SUPABASE_PUBLISHABLE_KEY` — que é o anon key público — mas a edge function pode esperar o token do usuário autenticado. Vamos verificar como a chamada é feita e garantir que o token correto é enviado.

Adicionalmente, as operações Void distorcem os dados enviados para a IA (ROI zerado, Win Rate inflado/deflado), fazendo com que a análise retorne valores sem sentido.

---

### Arquivos a modificar

1. **`src/hooks/useMethodAnalysis.ts`**
   - Corrigir `reds` para filtrar explicitamente `op.result === 'Red'`
   - Corrigir `winRate` para usar `greens / (greens + reds)`
   - Corrigir `totalStaked` no cálculo do ROI para excluir Voids
   - Corrigir `currentStreak` para tratar Void como neutro (não quebrar streak nem ser contado)

2. **`src/pages/DailyPlanning.tsx`**
   - Corrigir `winRate` (linha 537) para usar `greens / (greens + reds)`
   - Corrigir `todayWinRate` (linha 574) para excluir Voids do denominador
   - Garantir que `finalizedGames` inclua jogos com todos os métodos como Void (já funciona, mas adicionar comentário claro)

3. **`src/hooks/useFilteredStatistics.ts`**
   - Corrigir `winRate` em `overallStats` (linha 189) para excluir Voids
   - Corrigir `methodWinRate` (linha 236) para excluir Voids do denominador
   - Corrigir cálculo de lucro para garantir que Void não entra como Red no cálculo inline

4. **`src/hooks/useStatistics.ts`**
   - Corrigir `winRate` (linha 78) para excluir Voids do denominador

5. **`src/components/GameCardCompact.tsx`** (verificação)
   - Confirmar que `allMethodsResolved` trata Void como finalizado (já está correto, manter)

### Resumo das correções

| Arquivo | Problema | Correção |
|---|---|---|
| `useMethodAnalysis.ts` | `reds = total - greens` inclui Void | `reds = filter(Red)` |
| `useMethodAnalysis.ts` | ROI usa total com Void | `totalStaked = (greens + reds) * stake` |
| `useMethodAnalysis.ts` | Streak quebra em Void | Void é ignorado no streak |
| `DailyPlanning.tsx` | Win Rate inclui Void | `greens / (greens + reds)` |
| `useFilteredStatistics.ts` | Win Rate inclui Void | `greens / (greens + reds)` |
| `useStatistics.ts` | Win Rate inclui Void | `greens / (greens + reds)` |
