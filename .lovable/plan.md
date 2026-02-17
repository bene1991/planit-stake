

## Adicionar coluna de Lucro em R$ no Historico Diario por Metodo

### O que muda

Adicionar uma nova coluna "Lucro" na tabela de Historico Diario por Metodo, mostrando o resultado financeiro em R$ de cada dia e de cada metodo quando expandido.

### Alteracoes

**1. `src/hooks/useFilteredStatistics.ts`** - Calcular lucro R$ por dia e por metodo/dia

No bloco que constroi o `dayBreakdownMap` (linhas 378-439), adicionar acumulacao de `profitReais` tanto no total do dia quanto por metodo, usando a mesma logica de calculo de lucro ja existente no arquivo (linhas 458-477).

A interface `DayBreakdown` passara a incluir `totalProfitReais: number` e cada metodo dentro de `methods` tera `profitReais: number`.

**2. `src/components/Charts/DailyMethodBreakdown.tsx`** - Exibir coluna de Lucro

- Adicionar `profitReais` nas interfaces `MethodDayData` e `DayBreakdown`
- Adicionar coluna "Lucro" no header da tabela (apos "Saldo")
- Renderizar o valor formatado em R$ com cor verde (positivo) ou vermelha (negativo)
- Aplicar o mesmo padrao nas linhas expandidas dos metodos

### Resultado esperado

A tabela de historico diario mostrara:

```text
Data              | Greens | Reds | Win Rate | Saldo | Lucro
17/02 (segunda)   |   5    |  2   |  71.4%   |  +3   | +R$ 125,50
  -> Metodo A     |   3    |  1   |  75.0%   |  +2   | +R$ 80,30
  -> Metodo B     |   2    |  1   |  66.7%   |  +1   | +R$ 45,20
```

