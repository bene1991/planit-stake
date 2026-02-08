

## Corrigir Calculo de Lucro LAY em useFilteredStatistics.ts

### Problema

O arquivo `src/hooks/useFilteredStatistics.ts` tem a formula de lucro LAY errada em **3 lugares** (linhas 249-253, 469-473, 607-611). O codigo atual trata o `stakeValue` (que para LAY e a **responsabilidade/liability**) como se fosse o lucro direto.

**Exemplo concreto - Jogo do Benfica (Lay 1x0 Alavancagem):**
- stake_value = R$215,96 (responsabilidade), odd = 9.4, resultado = Green
- Calculo ERRADO (atual): 215,96 x 0,955 = **R$206,24**
- Calculo CORRETO: (215,96 / 8,4) x 0,955 = **R$24,55**

As 4 operacoes desse metodo somam R$935,89 com o bug. O valor correto e aproximadamente R$93.

### Causa raiz

Para operacoes LAY, o campo `stakeValue` armazena a **responsabilidade** (liability). A stake real do LAY e `stakeValue / (odd - 1)`. O `profitCalculator.ts` ja tem a logica correta, mas `useFilteredStatistics.ts` nao a segue.

### Correcao

Alterar as 3 ocorrencias em `src/hooks/useFilteredStatistics.ts`:

**LAY Green** (linhas 251, 471, 609):
```text
// ANTES (errado):
profitReais += op.stakeValue * (1 - commissionRate);

// DEPOIS (correto):
const stakeLay = op.stakeValue / (op.odd - 1);
profitReais += stakeLay * (1 - commissionRate);
```

**LAY Red** (linhas 253, 473, 611):
```text
// ANTES (errado):
profitReais -= op.stakeValue * (op.odd - 1);

// DEPOIS (correto - liability JA e o stakeValue):
profitReais -= op.stakeValue;
```

### Impacto

- Corrige o lucro de TODOS os metodos LAY em toda a pagina de Desempenho
- Corrige o "Melhor Metodo", ranking de metodos, evolucao de bankroll e graficos
- Alinha o calculo com a logica ja existente em `profitCalculator.ts`
- Afeta 3 blocos de calculo no mesmo arquivo

