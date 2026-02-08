

## Corrigir Calculo LAY - Valor de Entrada = Responsabilidade

### Problema

O sistema trata o "Valor de Entrada" como **stake** nas operacoes LAY, mas na verdade ele representa a **responsabilidade** (liability). Isso gera valores de lucro e prejuizo incorretos.

**Calculo atual (ERRADO):**
- Green: `stakeValue * (1 - comissao)` = 100 * 0.955 = R$ 95,50
- Red: `-stakeValue * (odd - 1)` = -100 * 14 = -R$ 1.400,00

**Calculo correto:**
- StakeLay = Responsabilidade / (Odd - 1) = 100 / 14 = 7,14
- Green: StakeLay * (1 - comissao) = 7,14 * 0.955 = R$ 6,82
- Red: -Responsabilidade = -R$ 100,00

### Arquivos Afetados

A mesma formula incorreta esta replicada em **3 arquivos**:

1. `src/utils/profitCalculator.ts` - Calculadora principal (usada em GameMethodEditor, GameCard, DailyPlanning, MonthlyReport)
2. `src/utils/exportToPDF.ts` - Calculo local para exportacao PDF
3. `src/utils/exportToExcel.ts` - Calculo local para exportacao Excel

### Plano de Correcao

**1. `src/utils/profitCalculator.ts`** - Corrigir ambas as funcoes:

`calculateProfit` (Lay):
```
// Green: stakeLay = responsabilidade / (odd - 1), lucro = stakeLay * (1 - comissao)
Green: (stakeValue / (odd - 1)) * (1 - commissionRate)

// Red: perde a responsabilidade inteira
Red: -stakeValue
```

`calculatePotentialProfit` (Lay):
```
green: (stakeValue / (odd - 1)) * (1 - commissionRate)
red: -stakeValue
```

Adicionar validacao: bloquear se `odd <= 1.01`.

**2. `src/utils/exportToPDF.ts`** - Mesma correcao na funcao `calculateProfitForPDF` (linhas 76-81)

**3. `src/utils/exportToExcel.ts`** - Mesma correcao na funcao `calculateProfit` local (linhas 67-71)

### Validacao com Exemplo

Entrada: Odd = 15, Responsabilidade = 100

| | Antes (errado) | Depois (correto) |
|---|---|---|
| StakeLay | N/A | 7,14 |
| Green | R$ 95,50 | R$ 6,82 |
| Red | -R$ 1.400,00 | -R$ 100,00 |
| Comissao | R$ 4,50 | R$ 0,32 |

### Secao Tecnica

As formulas corrigidas para LAY:

```
stakeLay = stakeValue / (odd - 1)
green = stakeLay * (1 - commissionRate)
red = -stakeValue
```

Onde `stakeValue` = responsabilidade informada pelo usuario.

Nenhuma mudanca em componentes de UI e necessaria - todos ja chamam as funcoes centralizadas (exceto os 2 arquivos de export que tem copias locais).
