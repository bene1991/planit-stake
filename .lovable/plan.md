

## Analise Pre-Jogo Completa

### Objetivo
Criar uma secao de analise pre-jogo acessivel a partir de cada card de jogo no planejamento, mostrando dados detalhados dos dois times usando a API-Football.

### Dados que serao exibidos

**1. Classificacao (Standings)**
- Posicao atual de cada time na liga
- Pontos, jogos, vitorias, empates, derrotas
- Saldo de gols

**2. Estatisticas de Gols (Team Statistics)**
- Media de gols feitos e sofridos (geral, casa, fora)
- Total de gols nos ultimos jogos
- Clean sheets e "failed to score"

**3. Minutagem de Gols**
- Distribuicao de gols por periodo (0-15, 16-30, 31-45, 46-60, 61-75, 76-90)
- Mostra em qual momento do jogo cada time marca e sofre mais

**4. Ultimos Resultados (Last 10 Fixtures)**
- Sequencia de resultados recentes (V/E/D)
- Placar de cada jogo

**5. Confrontos Diretos (Head to Head)**
- Ultimos confrontos entre os dois times
- Placar, data e competicao

**6. Predicoes da API (Predictions)**
- Porcentagens de vitoria/empate de cada time
- Conselho da API (se disponivel)

### Como acessar
- Um botao de "Analise Pre-Jogo" (icone de grafico/lupa) sera adicionado no card de cada jogo que tenha `api_fixture_id`
- Ao clicar, abre um modal/dialog fullscreen com todas as informacoes organizadas em abas ou secoes com scroll

---

### Detalhes Tecnicos

**Novos endpoints usados via edge function `api-football` (ja suporta qualquer endpoint):**
- `standings` - params: `{ league: leagueId, season }` 
- `teams/statistics` - params: `{ team: teamId, season, league: leagueId }`
- `fixtures/headtohead` - params: `{ h2h: "teamId1-teamId2", last: 10 }`
- `fixtures` - params: `{ team: teamId, last: 10 }` (ultimos jogos)
- `predictions` - params: `{ fixture: fixtureId }`

**Novos arquivos:**
1. `src/hooks/usePreMatchAnalysis.ts` - Hook que faz fetch de todos os dados pre-jogo em paralelo (standings, team stats, h2h, last fixtures, predictions). Usa o mesmo pattern de `useApiFootball` existente. Todos os dados sao cacheados via L1/L2 no backend.

2. `src/components/PreMatchAnalysis/PreMatchModal.tsx` - Modal principal com abas: Classificacao, Estatisticas, Minutagem, Ultimos Jogos, Confrontos, Predicoes.

3. `src/components/PreMatchAnalysis/StandingsSection.tsx` - Tabela de classificacao com destaque nos dois times do jogo.

4. `src/components/PreMatchAnalysis/GoalStatsSection.tsx` - Cards comparativos de media de gols feitos/sofridos, com barras visuais.

5. `src/components/PreMatchAnalysis/GoalMinutesSection.tsx` - Grafico de barras mostrando distribuicao de gols por periodo para cada time.

6. `src/components/PreMatchAnalysis/LastMatchesSection.tsx` - Lista dos ultimos 10 jogos de cada time com sequencia V/E/D.

7. `src/components/PreMatchAnalysis/HeadToHeadSection.tsx` - Historico de confrontos diretos.

8. `src/components/PreMatchAnalysis/PredictionsSection.tsx` - Previsoes da API com porcentagens visuais.

**Alteracao em arquivo existente:**
- `src/components/GameCardCompact.tsx` - Adicionar botao "Pre-Jogo" ao lado dos botoes de editar/excluir. Ao clicar, abre o `PreMatchModal`.

**Cache:** Todos os endpoints usam o cache L1+L2 ja implementado no edge function. Standings e team stats tem TTL de 1h+, minimizando consumo de creditos da API.

**Dependencia de dados:** O `api_fixture_id` do jogo ja contem o fixture ID. A partir dele, o hook busca o fixture para obter `league.id`, `league.season`, `teams.home.id` e `teams.away.id`, e entao faz as demais chamadas em paralelo.
