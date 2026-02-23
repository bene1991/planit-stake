
## Correcao das Medias na Aba Gols

### Problemas identificados

1. **Inconsistencia no modo Temporada**: Os percentuais de Over 1.5, Over 2.5 e BTTS sao calculados com base nos ultimos 20 jogos buscados da API, mas o label diz "Temporada completa". As medias de gols vem da API (temporada real), mas Over/BTTS sao de apenas 20 jogos.

2. **Jogos com placar null**: A funcao `computeAllStats` trata gols `null` como 0, o que pode incluir jogos nao finalizados no calculo, distorcendo as medias.

3. **Apresentacao confusa**: Exibir "Gols Feitos (Total)" junto com "Media Gols/Jogo" mistura informacoes absolutas e relativas. O sistema de referencia mostra apenas medias, que sao mais uteis para comparacao.

### Solucao proposta

**Arquivo: `src/components/PreMatchAnalysis/GoalStatsSection.tsx`**

1. **Filtrar jogos invalidos**: Antes de calcular, ignorar fixtures onde `goals.home` ou `goals.away` seja `null` (jogos nao finalizados).

2. **Reorganizar metricas na secao "Gols Global"**:
   - Remover "Gols Feitos (Total)" e "Gols Sofridos (Total)" (numeros absolutos nao sao uteis para comparacao entre times com quantidade diferente de jogos)
   - Manter apenas:
     - Media Gols Marcados (por jogo)
     - Media Gols Sofridos (por jogo)
     - Clean Sheets (com percentual entre parenteses, ex: "5 (33%)")
     - Nao Marcou (com percentual entre parenteses)
     - % Over 1.5
     - % Over 2.5
     - BTTS %

3. **Corrigir modo Temporada**: No modo Temporada, calcular Over/BTTS usando TODOS os fixtures disponíveis (nao apenas 20). Se os fixtures disponiveis forem menos que o total de jogos da temporada, exibir "(baseado em X jogos)" para transparencia.

4. **Secao "Gols Casa/Fora"**: Manter as medias casa x fora como estao, pois ja estao corretas.

### Detalhes tecnicos

**Filtro de jogos validos** - adicionar no inicio de `computeAllStats`:
```text
const valid = fixtures.filter(f => f.goals.home !== null && f.goals.away !== null);
const sliced = valid.slice(0, count);
```

**Clean Sheets e Nao Marcou com %** - calcular a porcentagem:
```text
cleanSheetsPct = n > 0 ? (cleanSheets / n) * 100 : 0
failedToScorePct = n > 0 ? (failedToScore / n) * 100 : 0
```

**Exibicao com formato "X (Y%)"** - criar um novo formato:
```text
const fmtCountPct = (count, total) => `${count} (${total > 0 ? Math.round((count/total)*100) : 0}%)`
```

**Modo Temporada com Over/BTTS** - usar todos os fixtures disponiveis e indicar a amostra:
```text
// Já usa homeLastMatches.length, mas precisa informar ao usuario
// que são os últimos 20 jogos, não a temporada completa
```

Nenhuma mudanca na API ou no hook - apenas correcoes de calculo e apresentacao no componente.
