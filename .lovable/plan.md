

## Corrigir Resumo - Mostrar Apenas Dados do Dia

### Problema

Os cards de resumo estao mostrando dados acumulados de TODOS os jogos (582 operacoes, R$3,91 de lucro total). Na pagina de Planejamento Diario, o resumo deve mostrar apenas os dados **do dia selecionado**.

### Solucao

Substituir os calculos dos 4 cards para usar apenas `todayGames` (jogos filtrados pela data atual) em vez de `allOps` (todos os jogos).

### Arquivo a modificar

**`src/pages/DailyPlanning.tsx`** (linhas 513-590)

Remover todo o calculo de `allOps`, `allGreens`, `allReds`, `allProfitMoney` etc. (linhas 514-533) e usar apenas os dados de `todayOps` nos 4 cards:

```text
Card 1 - Lucro Hoje:
  todayProfitMoney em R$ e Stakes (dados apenas do dia)

Card 2 - Operacoes Hoje:
  todayTotal com todayGreens G / todayReds R

Card 3 - Win Rate Hoje:
  (todayGreens / todayTotal) * 100

Card 4 - Jogos Hoje:
  todayGames.length + quantos ao vivo
```

Se nao houver jogos/operacoes no dia, os cards mostrarao zeros normalmente (R$0,00 / 0 operacoes / 0% / 0 jogos), o que e o comportamento correto para um dia sem atividade.

### Titulo da secao

Mudar de "Resumo Geral + Hoje" para apenas **"Resumo do Dia"**.

