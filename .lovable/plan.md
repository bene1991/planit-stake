

## Correcoes: Velocidade + Aprovacao por Criterios + Fix Stats Zeradas

### 1. Velocidade da Analise

**Problema**: A analise leva ~30s porque faz chamadas sequenciais em lotes de 5, com 3 chamadas API por fixture (H2H, home stats, away stats).

**Solucao**: Aumentar batch size de 5 para 10, e fazer o fetch de odds em paralelo com batches maiores (5 paginas simultaneas em vez de 3).

**Arquivo**: `supabase/functions/analyze-lay0x1/index.ts`
- Linha 441: `BATCH_SIZE = 5` -> `BATCH_SIZE = 10`
- Linha 136: Batch de paginas de odds de 3 para 5

Resultado esperado: reducao de ~30s para ~15s.

---

### 2. Jogos que passam em TODOS os criterios devem aparecer como aprovados

**Problema**: Linha 404 exige `allCriteriaMet && scoreValue >= dynamicMinScore`. Jogos com todos os criterios OK mas score 66 sao rejeitados.

**Solucao**: Mudar a logica de aprovacao:
- Se TODOS os criterios passaram -> aprovado (independente do score)
- O score continua sendo calculado e exibido para ranking/prioridade

```text
// ANTES (linha 404):
const isApproved = allCriteriaMet && scoreValue >= dynamicMinScore;

// DEPOIS:
const isApproved = allCriteriaMet;
```

O `dynamicMinScore` passa a ser usado apenas para a classificacao visual (badge "Forte", "Moderado", etc.), nao como filtro de aprovacao.

---

### 3. Fix: awayConcededAvg zerada (Brondby/Lechai)

**Problema**: Linhas 340-341 leem `awayGoalsAgainst?.average?.away` que retorna `null` ou `"0"` para times no inicio da temporada ou com poucos jogos fora. Resultado: `awayConcededAvg = 0`, criterio falha, jogo e rejeitado.

**Solucao**: Adicionar fallback para usar media geral (home+away) quando a media especifica `away` for 0:

```text
// ANTES:
const awayGoalsAgainst = awayStatsData?.response?.goals?.against;
const awayConcededAvg = awayGoalsAgainst?.average?.away 
  ? parseFloat(awayGoalsAgainst.average.away) : 0;

// DEPOIS:
const awayGoalsAgainst = awayStatsData?.response?.goals?.against;
let awayConcededAvg = awayGoalsAgainst?.average?.away 
  ? parseFloat(awayGoalsAgainst.average.away) : 0;

// Fallback: se away=0, usar media total (home+away combinada)
if (awayConcededAvg === 0 && awayGoalsAgainst?.average?.total) {
  awayConcededAvg = parseFloat(awayGoalsAgainst.average.total);
}
```

Mesma logica para `homeGoalsAvg`:

```text
// ANTES:
const homeGoalsFor = homeStatsData?.response?.goals?.for;
const homeGoalsAvg = homeGoalsFor?.average?.home 
  ? parseFloat(homeGoalsFor.average.home) : 0;

// DEPOIS:
const homeGoalsFor = homeStatsData?.response?.goals?.for;
let homeGoalsAvg = homeGoalsFor?.average?.home 
  ? parseFloat(homeGoalsFor.average.home) : 0;

// Fallback: se home=0, usar media total
if (homeGoalsAvg === 0 && homeGoalsFor?.average?.total) {
  homeGoalsAvg = parseFloat(homeGoalsFor.average.total);
}
```

---

### 4. Ordenacao dos resultados aprovados

Com a nova logica (todos que passam criterios sao aprovados), ordenar por score descendente para que os melhores jogos aparecam primeiro:

```text
// ANTES (linha 459-462):
results.sort((a, b) => {
  if (a.approved !== b.approved) return a.approved ? -1 : 1;
  return a.time.localeCompare(b.time);
});

// DEPOIS:
results.sort((a, b) => {
  if (a.approved !== b.approved) return a.approved ? -1 : 1;
  if (a.approved && b.approved) return b.score_value - a.score_value;
  return a.time.localeCompare(b.time);
});
```

---

### Resumo de Mudancas

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/analyze-lay0x1/index.ts` | Batch 10, odds pages 5, aprovacao por criterios, fallback stats zeradas, sort por score |

Apenas 1 arquivo precisa ser editado.

### Impacto

- Analise ~2x mais rapida (~15s em vez de ~30s)
- Brondby e Lechai voltam a aparecer (fallback de stats)
- Todos os jogos que passam nos criterios aparecem como aprovados
- Score continua visivel para ranking/priorizacao
