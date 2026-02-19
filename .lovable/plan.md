
## Corrigir filtro do Telegram - mostrar apenas jogos de hoje

### Problema
O botao Telegram esta mostrando TODOS os jogos que possuem metodo "Lay 0x1" ou "Lay 1x0", independente da data. Deveria mostrar apenas os jogos do dia atual.

### Solucao

**Atualizar `src/pages/DailyPlanning.tsx`** (2 pontos):

1. Na linha que verifica se o botao deve aparecer (linha 721), filtrar `games` por `todayDate` antes de passar para `buildTelegramGames`:
   - De: `buildTelegramGames(games, bankroll.methods)`
   - Para: `buildTelegramGames(games.filter(g => g.date === todayDate), bankroll.methods)`

2. No componente `TelegramPlanningMessage` (linha 810), passar apenas jogos de hoje:
   - De: `games={games}`
   - Para: `games={games.filter(g => g.date === todayDate)}`

Nenhuma alteracao no componente `TelegramPlanningMessage.tsx` em si - a filtragem por data sera feita antes de passar os dados.
