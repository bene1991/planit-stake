

## Correcoes no Scanner Lay 0x1: Calculo Over Real + Score Inteligente + Prob 0x1 + Indice de Risco + Modo Evolutivo

### Problemas Identificados

**1. Calculo Over 1.5 incorreto** (analyze-lay0x1, linhas 337-339)
- Soma percentuais linearmente: `homeGoalsAvg/2*100 + awayConcededAvg/2*100` = valores acima de 100%
- Sem significado probabilistico

**2. Score sem penalizacao por risco 0x1**
- Nao estima probabilidade real de 0x1
- Nao penaliza jogos com alta volatilidade

**3. Bug critico na validacao de bloqueio de ligas** (calibrate-lay0x1, linha 596)
- A variavel `leagueStats` referenciada na validacao de bloqueio da IA esta **fora de escopo** -- ela e local da funcao `detectPatterns()` (linha 81)
- A validacao adicionada anteriormente **nao funciona** porque `leagueStats` e `undefined` no contexto do `serve()`

**4. Calibracao nao esta alinhada com o novo modelo**
- Thresholds de `min_over15_combined` usam range [50, 120] (invalido para probabilidade real 0-100%)
- Modo evolutivo ja existe mas precisa do ciclo de 50 jogos

---

### Solucao Completa

#### Arquivo 1: `supabase/functions/analyze-lay0x1/index.ts`

**A. Nova funcao Poisson para Over 1.5 real**

```text
function poissonProbUnder15(lambda: number): number {
  // P(X<=1) = e^(-lambda) * (1 + lambda)
  return Math.exp(-lambda) * (1 + lambda);
}
```

**B. Substituir calculo Over** (linhas 337-340)

De:
```text
homeOver15Pct = min(100, (homeGoalsAvg / 2.0) * 100)
awayOver15Pct = min(100, (awayConcededAvg / 2.0) * 100)
over15Combined = soma dos dois
```

Para:
```text
pUnderHome = poissonProbUnder15(homeGoalsAvg)
pUnderAway = poissonProbUnder15(awayConcededAvg)
probOverReal = (1 - pUnderHome * pUnderAway) * 100  // 0-100%
over15Combined = round(probOverReal, 1)
```

**C. Probabilidade estimada de 0x1** (novo calculo)

Buscar dados adicionais do visitante para calcular frequencia de 0x1:
```text
// Dados ja disponiveis:
// - h2h0x1Count: quantas vezes deu 0x1 nos ultimos 5 H2H
// - awayConcededAvg: media gols sofridos fora pelo visitante
// - homeGoalsAvg: media gols do mandante em casa

// Estimativa de prob 0x1 usando Poisson:
// P(home=0) * P(away=1) 
prob0x1_poisson = Math.exp(-homeGoalsAvg) * (awayConcededAvg * Math.exp(-awayConcededAvg))

// Combinacao com H2H
prob0x1_h2h = h2h0x1Count / 5

// Prob combinada (ponderada)
prob0x1 = prob0x1_poisson * 0.6 + prob0x1_h2h * 0.4
```

Se `prob0x1 > 0.12` (12%), reduzir score proporcionalmente.

**D. Indice de Risco (volatilidade)**

Calcular consistencia estatistica e penalizar jogos com dados inconsistentes:
```text
// Quanto mais distantes os indicadores, maior o risco
riskIndex = 0

// Divergencia ofensiva/defensiva (mandante ataca muito mas visitante nao sofre)
divergence = Math.abs(homeGoalsAvg - awayConcededAvg)
if (divergence > 1.0) riskIndex += normalize(divergence, 1.0, 2.5) * 5

// Odds divergentes do perfil estatistico
expectedOddRatio = homeGoalsAvg / (awayConcededAvg || 0.5)
actualOddRatio = awayOdd / homeOdd
oddsDivergence = Math.abs(expectedOddRatio - actualOddRatio)
if (oddsDivergence > 1.5) riskIndex += normalize(oddsDivergence, 1.5, 3.0) * 5
```

**E. Score Inteligente final** (substituir linhas 360-371)

```text
// Score base ponderado (igual ao atual, mas com overScore usando probOverReal)
overScore = normalize(probOverReal, 30, 95) * (over_weight / totalWeight)
// ... demais componentes iguais

baseScore = (todos os componentes) * 100

// Penalizacao 1: risco de 0x1
penalty0x1 = 0
if (prob0x1 > 0.12) {
  penalty0x1 = (prob0x1 - 0.12) * 100  // proporcional ao excesso
}

// Penalizacao 2: indice de risco (volatilidade)
// riskIndex ja calculado acima (0-10)

finalScore = baseScore - penalty0x1 - riskIndex
scoreValue = clamp(round(finalScore), 0, 100)
```

**F. Novos campos no criteria snapshot**

Adicionar ao retorno:
- `prob_over_real`: probabilidade Over 1.5 real (Poisson)
- `prob_0x1`: probabilidade estimada de 0x1
- `risk_index`: indice de risco/volatilidade

---

#### Arquivo 2: `supabase/functions/calibrate-lay0x1/index.ts`

**A. Corrigir bug do leagueStats fora de escopo**

A funcao `detectPatterns()` calcula `leagueStats` internamente mas nao o retorna. Na linha 596, o codigo tenta usar `leagueStats[league]` que e undefined.

Solucao: fazer `detectPatterns()` retornar tambem o `leagueStats` para uso na validacao de bloqueio:

```text
// detectPatterns agora retorna { patterns, leagueStats }
function detectPatterns(analyses: any[]): { patterns: Record<string, any>, leagueStats: Record<string, { total: number; reds: number }> } {
  // ... codigo existente ...
  return { patterns, leagueStats };
}
```

E na chamada (linha 493):
```text
const { patterns, leagueStats } = detectPatterns(analyses);
```

**B. Ajustar THRESHOLD_LIMITS** (linha 28)

```text
min_over15_combined: [30, 95],  // antes era [50, 120]
```

**C. Modo Evolutivo a cada 50 jogos**

A calibracao ja roda automaticamente. Ajustar para usar ciclos de 50 (ja e configuravel pelo `cycle_count`). Nao precisa mudar a logica existente, apenas o trigger no frontend que ja dispara a cada N jogos resolvidos.

---

#### Arquivo 3: `src/components/Lay0x1/Lay0x1Scanner.tsx`

**A. Ajustar slider Over 1.5** (linha 661)

```text
<Slider value={[weights.min_over15_combined]} min={30} max={95} step={5} .../>
```

---

### Resumo de Arquivos

| Arquivo | Mudancas |
|---|---|
| `supabase/functions/analyze-lay0x1/index.ts` | Poisson Over, Prob 0x1, Indice de Risco, Score Inteligente |
| `supabase/functions/calibrate-lay0x1/index.ts` | Fix leagueStats scope, threshold limits [30,95] |
| `src/components/Lay0x1/Lay0x1Scanner.tsx` | Slider max 150 para 95 |

### Impacto

- Todos os scores serao recalculados com o novo modelo
- O `min_over15_combined` salvo do usuario pode precisar de ajuste se estiver acima de 95
- A penalizacao por 0x1 vai reduzir scores de jogos com perfil perigoso
- O bug de leagueStats sera corrigido para que a validacao de bloqueio funcione de verdade

