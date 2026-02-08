

## Corrigir Resumo do Dia - Mostrar Dados Reais

### Problema

O resumo do dia esta filtrando apenas jogos com `date === todayDate` (2026-02-08), mas voce nao tem jogos cadastrados para hoje. Por isso todos os cards mostram zero. O resumo precisa mostrar os dados do dia **E** um resumo geral.

### Solucao

Mudar a logica do resumo para mostrar **duas linhas de informacao**:

1. **Resumo Geral** (todos os jogos) - sempre visivel com os totais acumulados
2. **Resumo do Dia** (jogos de hoje) - mostra os dados do dia atual quando houver jogos hoje

### Arquivo a modificar

**`src/pages/DailyPlanning.tsx`** (linhas 512-562)

Substituir o bloco do "Resumo do Dia" para:

- Calcular stats de **todos os jogos** (greens totais, reds totais, lucro total, win rate geral)
- Calcular stats de **hoje** separadamente
- Mostrar 4 cards com dados gerais acumulados
- Se houver jogos hoje, mostrar uma linha adicional com o resumo do dia

### Logica dos cards

```text
Card 1 - Lucro Total:
  - Soma de profit de TODAS as operacoes com resultado
  - Mostra em R$ e em Stakes

Card 2 - Operacoes Totais:
  - Total de greens e reds de todos os jogos
  - Formato: "289G / 293R"

Card 3 - Win Rate Geral:
  - (greens / total) * 100
  - Mostra porcentagem

Card 4 - Jogos Hoje:
  - Quantidade de jogos com date === todayDate
  - Quantos estao ao vivo
  - Se houver resultados hoje, mostra lucro do dia abaixo
```

### Detalhes tecnicos

A mudanca principal e na linha 514, trocar:

```text
// ANTES: filtra so hoje (fica zerado se nao tem jogos hoje)
const todayGames = games.filter(g => g.date === todayDate);
const todayOps = todayGames.flatMap(...)

// DEPOIS: usa TODOS os jogos para os totais
const allOps = games.flatMap(g => g.methodOperations).filter(op => op.result);
const allGreens = allOps.filter(op => op.result === 'Green').length;
// ... e calcula today separadamente para o card de "Jogos Hoje"
const todayGames = games.filter(g => g.date === todayDate);
```

Os cards 1-3 usarao dados de `allOps` (acumulado geral) e o card 4 mostrara dados de `todayGames` (dia atual).
