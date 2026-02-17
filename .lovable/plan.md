
## Adicionar coluna de % sobre a Stake no Historico Diario

### O que o usuario quer

Mostrar o lucro/perda como fracao da stake unitaria configurada no topo da pagina. Exemplo: se a stake e R$10 e o lucro do dia foi R$10, exibir "+1.00 stake". Se perdeu R$6,70, exibir "-0.67 stake".

### Alteracoes

**1. `src/pages/Performance.tsx`** - Passar `stakeValueReais` para o componente

Na linha 567 onde renderiza `<DailyMethodBreakdown data={dailyBreakdown} />`, adicionar a prop `stakeValueReais={parsedStake}`.

**2. `src/components/Charts/DailyMethodBreakdown.tsx`** - Adicionar coluna "Stakes"

- Adicionar prop `stakeValueReais: number` na interface do componente
- Adicionar coluna "Stakes" no header da tabela (apos "Lucro")
- Calcular `profitReais / stakeValueReais` para cada dia e cada metodo expandido
- Exibir com formato `+1.25 st` ou `-0.67 st` com cor verde/vermelha
- Mostrar "—" se stakeValueReais for 0

### Resultado esperado

```text
Data              | Greens | Reds | Win Rate | Saldo | Lucro        | Stakes
17/02 (segunda)   |   5    |  2   |  71.4%   |  +3   | +R$ 125,50   | +12.55 st
  -> Metodo A     |   3    |  1   |  75.0%   |  +2   | +R$ 80,30    | +8.03 st
  -> Metodo B     |   2    |  1   |  66.7%   |  +1   | +R$ 45,20    | +4.52 st
```
