
## Plano: Corrigir Cálculo do Risco de Ruína para Usar Valor Real da Banca

### Problema Identificado

O cálculo do **Coeficiente de Ruína** está incorreto:

```typescript
// ATUAL (errado) - linha 133 de useBankrollHealth.ts
const bankrollEstimate = stakeValueReais * 100; // Assume 100 stakes = bankroll
const ruinCoefficient = bankrollEstimate > 0 ? maxDrawdown / bankrollEstimate : 0;
```

Isso significa que se a stake é R$100, o sistema assume que a banca é R$10.000, ignorando o valor real configurado pelo usuário na aba "Banca".

### Solução

Passar o valor real da banca (`bankroll.total`) para o hook `useBankrollHealth` e usar esse valor no cálculo.

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/hooks/useBankrollHealth.ts` | Adicionar prop `bankrollTotal` e usar no cálculo |
| `src/pages/Performance.tsx` | Passar `bankroll.total` para o hook |
| `src/components/AIPerformanceAnalyzer.tsx` | Passar `bankrollTotal` para o hook |

### Detalhes Técnicos

#### 1. Atualizar Interface do Hook

```typescript
// src/hooks/useBankrollHealth.ts
interface UseBankrollHealthProps {
  games: Game[];
  totalProfit: number;
  winRate: number;
  breakevenRate: number;
  targetMonthlyStakes?: number;
  stakeValueReais?: number;
  bankrollTotal?: number;        // NOVO: Valor real da banca
  uniqueLeagues?: number;
  uniqueMethods?: number;
}
```

#### 2. Atualizar Cálculo do Coeficiente de Ruína

```typescript
// ANTES (estimativa)
const bankrollEstimate = stakeValueReais * 100;
const ruinCoefficient = bankrollEstimate > 0 ? maxDrawdown / bankrollEstimate : 0;

// DEPOIS (valor real)
const actualBankroll = bankrollTotal || (stakeValueReais * 100); // fallback se não tiver
const ruinCoefficient = actualBankroll > 0 ? maxDrawdown / actualBankroll : 0;
```

#### 3. Atualizar Performance.tsx

```typescript
// Passar bankroll.total para o hook
const healthMetrics = useBankrollHealth({
  games: games.filter(g => { /* ... */ }),
  totalProfit: totalProfitReais,
  winRate: overallStats.winRate,
  breakevenRate,
  targetMonthlyStakes: settings.metaMensalStakes,
  stakeValueReais: parsedStake,
  bankrollTotal: bankroll.total,  // NOVO
  uniqueLeagues: leagueStats.length,
  uniqueMethods: methodDetailStats.length,
});
```

#### 4. Atualizar AIPerformanceAnalyzer.tsx

```typescript
const healthMetrics = useBankrollHealth({
  games,
  totalProfit,
  winRate: statistics.overallStats.winRate,
  breakevenRate: statistics.breakevenRate,
  targetMonthlyStakes,
  stakeValueReais,
  bankrollTotal,  // NOVO - precisa receber como prop
  uniqueLeagues: leagueStats.length,
  uniqueMethods: statistics.methodDetailStats.length,
});
```

### Exemplo Prático

| Cenário | Antes (Estimativa) | Depois (Real) |
|---------|-------------------|---------------|
| Stake: R$100, Banca Real: R$5.000 | Banca usada: R$10.000 | Banca usada: R$5.000 |
| Drawdown Máximo: R$500 | Risco: 5% | Risco: 10% |

### Resultado Esperado

O card "Risco de Ruína" mostrará a porcentagem correta baseada no valor real da banca configurado pelo usuário, proporcionando uma análise de risco mais precisa e relevante.

### Benefícios

1. **Precisão**: Cálculo usa dados reais configurados pelo usuário
2. **Consistência**: Integração entre aba "Desempenho" e "Banca"
3. **Risco realista**: Percentual de ruína reflete a situação real do trader
