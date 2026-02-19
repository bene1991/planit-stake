

## Corrigir calculo de stakes no Resumo Telegram

### Problema identificado

O calculo atual divide o lucro de cada operacao pelo `stakeValue` (valor de entrada/responsabilidade) daquela operacao individual. Porem, o conceito correto de "1 stake" no sistema e um valor de referencia fixo configurado nas configuracoes operacionais (`stakeValueReais`, ex: R$25).

Exemplo: se o lucro de uma operacao e R$2,50 e o stakeReference e R$25, o resultado correto e +10% de stake (0.10 st). Mas o codigo atual divide por `op.stakeValue` (que pode ser R$100 de responsabilidade), dando um valor errado.

A pagina de Performance ja faz esse calculo corretamente: `profitReais / stakeValueReais`.

### Solucao

**Arquivo: `src/components/TelegramSummaryMessage.tsx`**

1. Importar e usar o hook `useOperationalSettings` para obter o `stakeValueReais` (valor de referencia de 1 stake)

2. Alterar a funcao `buildSummaryItems` para receber `stakeReference` como parametro

3. Corrigir o calculo de `stakePercent`:
   - Se `op.profit` existe: `stakePercent = (op.profit / stakeReference) * 100`
   - Se `op.profit` nao existe mas tem `stakeValue`, `odd`, `operationType` e `result`: calcular o profit via `calculateProfit()` e depois dividir por `stakeReference`
   - Isso garante consistencia com o calculo da pagina Performance

4. No totalizador, a soma de `stakePercent` de todos os itens dara o resultado correto em % de stake

### Resultado esperado

Se o lucro total do dia em R$ dividido pelo stakeReference da 0.90 stakes, o totalizador mostrara "+90.0% de stake", consistente com o que aparece na pagina Performance.

### Detalhes tecnicos

```text
Antes (errado):
  stakePercent = (op.profit / op.stakeValue) * 100
  -> cada operacao divide por um valor diferente

Depois (correto):
  stakePercent = (op.profit / stakeReference) * 100
  -> todas as operacoes dividem pelo mesmo valor de referencia
```

Alteracoes apenas em `src/components/TelegramSummaryMessage.tsx`:
- Adicionar `useOperationalSettings` ao componente
- Passar `stakeReference` para `buildSummaryItems`
- Substituir `op.stakeValue` por `stakeReference` na divisao do calculo de percentual

