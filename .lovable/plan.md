
## Filtro de Quantidade de Jogos na Aba "Gols"

### O que muda
Adicionar um seletor (dropdown) na aba "Gols" da analise pre-jogo para escolher quantos jogos usar no calculo: **5, 10, 15, 20 ou Temporada completa**.

### Como vai funcionar
- Ao selecionar "Temporada" (padrao atual), continua usando as estatisticas completas da temporada que ja vem da API
- Ao selecionar 5, 10, 15 ou 20 jogos, o sistema calcula as estatisticas a partir dos ultimos jogos de cada time (gols feitos, sofridos, medias, clean sheets, etc.)

### Mudancas necessarias

**1. Hook `usePreMatchAnalysis.ts`**
- Aumentar o fetch de ultimos jogos de `last: 10` para `last: 20` para ambos os times, permitindo filtrar por qualquer quantidade ate 20

**2. Componente `GoalStatsSection.tsx`**
- Adicionar um `Select` dropdown no topo com opcoes: 5, 10, 15, 20, Temporada
- Receber tambem os dados de `homeLastMatches` e `awayLastMatches` como props
- Receber `homeTeamId` e `awayTeamId` para identificar se o time jogou em casa ou fora
- Quando uma quantidade especifica for selecionada, calcular as estatisticas (gols feitos, sofridos, medias, clean sheets, nao marcou) a partir dos fixtures filtrados
- Quando "Temporada" for selecionada, usar os dados originais da API (`homeStats`/`awayStats`)
- Exibir "Baseado em X jogos" abaixo do seletor

**3. Componente `PreMatchModal.tsx`**
- Passar os dados extras (`homeLastMatches`, `awayLastMatches`, `homeTeamId`, `awayTeamId`) para o `GoalStatsSection`

### Detalhes tecnicos

O calculo client-side a partir dos fixtures funciona assim:
- Cada fixture tem `goals.home` e `goals.away`
- Para saber se o time marcou/sofreu, verifica se ele era `teams.home` ou `teams.away`
- **Gols feitos**: soma dos gols do time nos N jogos
- **Gols sofridos**: soma dos gols do adversario nos N jogos
- **Media**: total dividido por N
- **Clean sheet**: jogos onde o adversario fez 0 gols
- **Nao marcou**: jogos onde o time fez 0 gols

Nenhuma chamada extra a API sera feita - apenas aumenta de 10 para 20 o parametro `last` que ja existe.
