

## Adicionar Metricas Financeiras ao Resumo do Modelo (Historico IA)

### Contexto

O card "Resumo do Modelo Atual" em `src/components/Lay0x1/Lay0x1History.tsx` atualmente mostra apenas: Versao, Taxa de Acerto, Ajustes Realizados e ROI em unidades. O usuario quer ver metricas financeiras reais considerando odd media ~15.

### Calculos Financeiros (Lay 0x1, odd media 15)

- **Lucro por Green**: 1/(15-1) = 7,14% da responsabilidade (stake)
- **Lucro liquido por Green**: 7,14% x (1 - 4,5%) = **6,82%** do stake
- **Perda por Red**: -100% do stake
- **Break-even**: 100 / (100 + 6,82) = **93,6%**
- **ROI**: ((greens x 0,0682) - (reds x 1)) / total_operacoes x 100

### Mudancas no Arquivo

**Arquivo**: `src/components/Lay0x1/Lay0x1History.tsx`

1. Adicionar constantes para os calculos financeiros (odd media, comissao)
2. Calcular break-even, lucro liquido total em % de stakes e ROI financeiro
3. Expandir o grid de `grid-cols-2 sm:grid-cols-4` para `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` com mais cards
4. Adicionar os seguintes cards ao grid existente:
   - **Greens / Reds**: Ex: "45 / 3" com cores verde e vermelho
   - **Break-even**: "93,6%" com indicador se a taxa atual esta acima ou abaixo
   - **ROI Financeiro**: Percentual calculado com lucro liquido (apos comissao)
   - **Lucro Liquido**: Em unidades de stake (ex: "+0,75 stakes")

5. Manter os cards existentes (Versao, Taxa Acerto, Ajustes, ROI unidades) e adicionar os novos abaixo em uma segunda linha

### Detalhes Tecnicos

Calculos a adicionar antes do JSX:

```text
const AVG_ODD = 15;
const COMMISSION = 0.045;
const GREEN_PROFIT_RATE = (1 / (AVG_ODD - 1)) * (1 - COMMISSION); // ~0.0682
const BREAKEVEN_RATE = 100 / (100 + GREEN_PROFIT_RATE * 100); // ~93.6%

const netProfitStakes = (totalGreens * GREEN_PROFIT_RATE) - totalReds;
const roiPercent = resolvedAnalyses.length > 0 
  ? ((netProfitStakes / resolvedAnalyses.length) * 100) 
  : 0;
```

Novos cards no grid (segunda linha):

- Greens/Reds: `{totalGreens}G / {totalReds}R`
- Break-even: `{BREAKEVEN_RATE.toFixed(1)}%` com badge indicando se taxa atual esta segura
- ROI Financeiro: `{roiPercent.toFixed(2)}%`
- Lucro Liquido: `{netProfitStakes >= 0 ? '+' : ''}{netProfitStakes.toFixed(2)} stakes`

### Resultado Visual

O card "Resumo do Modelo Atual" tera 2 linhas de metricas:
- Linha 1: Versao | Taxa Acerto | Ajustes | ROI (unidades) -- existente
- Linha 2: Greens/Reds | Break-even | ROI Financeiro | Lucro Liquido -- novo

