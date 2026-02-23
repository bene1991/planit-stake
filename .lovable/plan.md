

## Alimentar a IA com Contexto Financeiro do Lay + Backtest 90 Dias

### Contexto do Problema

Na estrategia Lay 0x1, a odd media de entrada e ~15.0, o que significa:
- **Lucro por Green**: ~7.14% do liability (stake = liability / (odd - 1), lucro = stake * 0.955)
- **Perda por Red**: 100% do liability
- **Break-even real**: ~93.3% de taxa de acerto (1 Red anula ~14 Greens)

O sistema atual nao tem essa informacao critica. A calibracao e a IA recomendam score minimo de 65-70 e consideram 50% de taxa como aceitavel, quando na verdade 50% geraria prejuizo catastrofico. A IA precisa saber que precisa buscar taxas acima de 93% para ser lucrativa.

### Alteracoes

#### 1. Ampliar Backtest para 90 Dias

**Arquivo**: `src/components/Lay0x1/Lay0x1Scanner.tsx`

Adicionar opcao "90d" no array `rangeShortcuts`:
```
{ label: '7d', days: 7 },
{ label: '15d', days: 15 },
{ label: '30d', days: 30 },
{ label: '90d', days: 90 },
```

#### 2. Alimentar a IA com Contexto Financeiro do Lay

**Arquivo**: `supabase/functions/calibrate-lay0x1/index.ts`

Atualizar o prompt da IA (`callAIForCalibration`) para incluir o contexto financeiro critico:

- Adicionar ao prompt: "Na estrategia Lay 0x1, a odd media de entrada e ~15.0. Isso significa que cada Green gera ~7.14% de lucro sobre o liability, mas cada Red perde 100% do liability. Portanto, 1 Red anula aproximadamente 14 Greens. O break-even real e ~93.3% de taxa de acerto. Taxas abaixo de 90% geram prejuizo. Este contexto e FUNDAMENTAL para todas as suas recomendacoes."
- Calcular e enviar a odd media real dos jogos analisados (de `criteria_snapshot.away_odd`)
- Calcular e enviar o break-even real com base na odd media
- Calcular e enviar o ROI estimado com base na taxa de acerto atual e odd media

#### 3. Ajustar Logica de Score Minimo Dinamico

**Arquivo**: `supabase/functions/calibrate-lay0x1/index.ts`

O fallback atual eleva score minimo para 70 quando taxa < 65%. Com o contexto financeiro correto, a IA vai entender que precisa ser MUITO mais seletiva:
- Recomendar scores minimos mais altos (75-85) porque a taxa de acerto precisa ser > 93%
- A IA vai priorizar bloquear ligas com qualquer Red, nao apenas > 50%
- A IA vai recomendar thresholds mais rigorosos para maximizar a taxa de acerto

#### 4. Incluir Metricas Financeiras nos Dados Enviados a IA

**Arquivo**: `supabase/functions/calibrate-lay0x1/index.ts`

Calcular e enviar:
- `avg_lay_odd`: media das odds dos jogos analisados
- `break_even_rate`: taxa minima para nao perder (1 - 1/avg_odd)
- `current_roi`: ROI real estimado com base na taxa atual
- `greens_per_red`: quantos Greens sao necessarios para cobrir 1 Red

### Detalhes Tecnicos

**`src/components/Lay0x1/Lay0x1Scanner.tsx`**:
- Linha 112-116: Adicionar `{ label: '90d', days: 90 }` ao array `rangeShortcuts`

**`supabase/functions/calibrate-lay0x1/index.ts`**:
- Funcao `callAIForCalibration`: Adicionar campo `financialContext` aos parametros
- Antes de chamar a IA (fase 4), calcular metricas financeiras dos jogos analisados
- Atualizar o prompt com secao "Contexto Financeiro Critico" contendo odd media, break-even, ROI
- Instruir a IA explicitamente que taxas abaixo de 90% sao insustentaveis no Lay 0x1

**Calculo das metricas financeiras**:
```text
avg_odd = media de criteria_snapshot.away_odd de todos os jogos
profit_per_green = 1 / (avg_odd - 1) * 0.955
break_even = 1 - profit_per_green / (1 + profit_per_green)
greens_per_red = Math.ceil(1 / profit_per_green)
roi = (greens * profit_per_green - reds) / total_analyses * 100
```

### Arquivos Modificados

- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- Adicionar opcao 90d no backtest
- `supabase/functions/calibrate-lay0x1/index.ts` -- Contexto financeiro no prompt da IA, metricas de ROI/break-even

### Resultado

- Backtest agora cobre ate 90 dias de historico
- A IA sabe que 1 Red = ~14 Greens perdidos e que o break-even e ~93%
- Recomendacoes da IA serao muito mais rigorosas e alinhadas com a realidade financeira do Lay
- Score minimo recomendado pela IA sera naturalmente mais alto (75-85)
- Ligas com qualquer indicativo de risco serao bloqueadas mais agressivamente
