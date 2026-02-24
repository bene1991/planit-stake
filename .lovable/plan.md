

## Odds 1X2 e Logos dos Times no Lay 0x1

### O que sera feito

1. **Exibir odds 1X2 (Casa / Empate / Visitante)** em cada card do scanner Lay 0x1
2. **Exibir logos dos times** ao lado dos nomes no card do scanner

---

### Detalhes tecnicos

#### 1. Edge Function: retornar draw_odd + logos

**Arquivo:** `supabase/functions/analyze-lay0x1/index.ts`

- Na funcao `extractOdds`, extrair tambem o valor do empate (Draw/X) alem de home e away.
- Na funcao `analyzeFixture`, capturar as logos dos times de `fixture.teams.home.logo` e `fixture.teams.away.logo` (ja disponivel nos dados da API-Football).
- Adicionar ao objeto `criteria` retornado: `draw_odd`.
- Adicionar ao resultado: `home_team_logo` e `away_team_logo`.

#### 2. Interface AnalysisResult: novos campos

**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Adicionar `draw_odd` no tipo criteria (ja tem `home_odd` e `away_odd`).
- Adicionar `home_team_logo?: string` e `away_team_logo?: string` no tipo `AnalysisResult`.

#### 3. ScoreCard: exibir odds e logos

**Arquivo:** `src/components/Lay0x1/Lay0x1ScoreCard.tsx`

- Receber novas props: `homeOdd`, `drawOdd`, `awayOdd`, `homeTeamLogo`, `awayTeamLogo`.
- Exibir logos (imagem pequena 20x20) ao lado dos nomes dos times.
- Adicionar uma linha compacta com as odds 1X2 (tres badges: "1", "X", "2") no estilo similar ao `OddsDisplay` ja existente no app.

#### 4. Scanner: passar novos dados ao ScoreCard

**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Passar `homeOdd`, `drawOdd`, `awayOdd` do `criteria` e `home_team_logo`, `away_team_logo` do resultado para o `Lay0x1ScoreCard`.

---

### Sequencia

1. Atualizar edge function (extrair draw + logos)
2. Deploy da edge function
3. Atualizar tipos no frontend
4. Atualizar ScoreCard com logos e odds 1X2
5. Passar novos dados do Scanner para o ScoreCard

### Notas

- Dados de cache existentes nao terao draw_odd/logos (campos opcionais, exibidos somente quando disponveis).
- Logos vem direto da API-Football (URL publica), sem custo adicional de requisicao.
- Draw odd vem do mesmo endpoint de odds ja consultado, sem chamada extra.
