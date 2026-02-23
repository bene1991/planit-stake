

## Otimizar Velocidade do Scanner Lay 0x1

### Problema

A edge function `analyze-lay0x1` processa cada fixture sequencialmente num loop `for`. Para cada fixture faz 3 chamadas API (H2H, home stats, away stats). Com 30 fixtures pre-filtrados, sao ~90 chamadas sequenciais, o que leva varios minutos.

### Solucao

Processar os fixtures em **lotes paralelos** de 5 (ao inves de 1 por 1), reduzindo o tempo total em ~5x.

### Detalhes Tecnicos

**Edge function `analyze-lay0x1/index.ts`:**

Substituir o loop sequencial (linha 248-402) por processamento em lotes:

```text
Antes:  for (fixture of fixtures) { await analyzeOne(fixture) }  // sequencial
Depois: for (batch of chunks(fixtures, 5)) { await Promise.all(batch.map(analyzeOne)) }  // 5 em paralelo
```

- Extrair a logica de analise de um fixture para uma funcao `analyzeFixture()`
- Processar em lotes de 5 fixtures simultaneos usando `Promise.all`
- Manter o limite de 50 fixtures maximo (ja existe)
- Adicionar progresso nos logs: "Batch 1/6 complete..."

**Frontend `Lay0x1Scanner.tsx`:**

- Adicionar timeout de 120s na chamada da edge function para evitar hang infinito
- Melhorar mensagem de loading com estimativa: "Analisando X jogos..."

### Impacto

- 30 fixtures: de ~90s sequencial para ~18s (5x mais rapido)
- 50 fixtures: de ~150s para ~30s

### Arquivos Modificados

1. `supabase/functions/analyze-lay0x1/index.ts` -- processamento em lotes paralelos
2. `src/components/Lay0x1/Lay0x1Scanner.tsx` -- mensagem de loading melhorada

