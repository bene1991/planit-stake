
## Painel Duplo Fixo: Planejamento e Lay 0x1

### Visao Geral

Transformar as abas Planejamento e Lay 0x1 em layout de painel duplo (split view): lista de jogos a esquerda (35%) e painel de analise completa a direita (65%). Clicar em um jogo na lista carrega toda a analise no painel direito, sem modal.

Em telas mobile (< 1024px), manter layout single-column atual com navegacao por clique.

---

### Arquitetura dos Componentes

```text
DailyPlanning / Lay0x1Scanner
  +----------------------------------+---------------------------------------------+
  |  Lista de jogos (35%)            |  Painel de Analise (65%)                    |
  |  - Filtros existentes            |  - Header: logos + nomes + odds 1X2         |
  |  - GameListByLeague / ScoreCards |  - Tabs: Predicao, Classif, Gols, etc.     |
  |  - Click => seleciona jogo       |  - Secao Matematica (lambda, overs, BTTS)  |
  |                                  |  - [Lay0x1] Risco Lay + Simulacao           |
  +----------------------------------+---------------------------------------------+
```

---

### Arquivos a criar

#### 1. `src/components/PreMatchAnalysis/PreMatchPanel.tsx` (NOVO)

Componente reutilizavel que renderiza TODA a analise pre-match inline (sem Dialog/Modal). Extrai a logica do `PreMatchModal` mas sem o wrapper `Dialog`.

- Recebe `fixtureId`, `homeTeam`, `awayTeam`
- Usa o hook `usePreMatchAnalysis` existente
- Renderiza as mesmas 6 abas: Predicao, Classificacao, Gols, Minutagem, Ultimos, H2H
- Nenhum dado removido, mesma estrutura visual

#### 2. `src/components/PreMatchAnalysis/MathAnalysisSection.tsx` (NOVO)

Secao de analise matematica baseada nos ultimos 20 jogos (com fallback para 15 e 10).

Calcula a partir dos dados de `homeLastMatches` e `awayLastMatches` (ja disponiveis no `usePreMatchAnalysis`):
- Lambda Casa (media gols marcados casa nos ultimos N jogos como mandante)
- Lambda Visitante (media gols marcados fora nos ultimos N jogos como visitante)
- Lambda Total
- Probabilidade Over 1.5 / 2.5 / 3.5 via distribuicao Poisson (1 - P(0) - P(1) para Over 1.5, etc.)
- Odd Justa = 1 / Probabilidade
- BTTS: P(ambos marcam) = (1 - P(casa=0)) * (1 - P(fora=0))
- Probabilidade de 0x1: P(casa=0) * P(fora=1) via Poisson
- Indicador de confiabilidade: Alta (20 jogos), Media (15), Baixa (10)

Todos os calculos sao feitos no frontend, sem chamada extra de API.

#### 3. `src/components/Lay0x1/Lay0x1RiskPanel.tsx` (NOVO)

Secao especifica do Lay 0x1 que aparece abaixo da analise matematica:
- Probabilidade real de 0x1 (do MathAnalysisSection)
- Diferenca entre odd de mercado (away_odd) e odd justa (1/P(0x1))
- Indicador de risco: Baixo (odd mercado > 2x odd justa), Medio, Alto (odd mercado < odd justa)
- Simulacao financeira: responsabilidade padrao do sistema (stakeReference), lucro potencial Green, perda potencial Red

#### 4. `src/components/PreMatchAnalysis/FixtureDetailPanel.tsx` (NOVO)

Container principal do painel direito. Compoe:
- Header com logos, nomes dos times, odds 1X2, liga
- `PreMatchPanel` (analise completa existente)
- `MathAnalysisSection` (nova secao matematica)
- Prop opcional `lay0x1Data` para renderizar `Lay0x1RiskPanel` quando usado na aba Lay 0x1

---

### Arquivos a modificar

#### 5. `src/pages/DailyPlanning.tsx`

- Adicionar estado `selectedFixtureId` (string | null)
- Em telas >= lg (1024px), envolver o conteudo em `grid grid-cols-[35%_1fr]`
- Coluna esquerda: conteudo atual (filtros + GameListByLeague + historico), com scroll independente
- Coluna direita: `FixtureDetailPanel` quando `selectedFixtureId` estiver preenchido, senao placeholder
- Ao clicar em um jogo no `GameListByLeague`, setar `selectedFixtureId` em vez de abrir modal
- Em mobile (< lg): manter layout atual, clicar abre o painel em tela cheia (ou usa o modal existente)
- Passar callback `onSelectGame` para `GameListByLeague`

#### 6. `src/components/GameListByLeague.tsx`

- Adicionar prop `onSelectGame?: (game: Game) => void`
- Adicionar prop `selectedGameId?: string` (para highlight visual)
- Passar para `GameListItem`

#### 7. `src/components/GameListItem.tsx`

- Adicionar prop `onSelect?: () => void`
- Adicionar prop `isSelected?: boolean`
- No click principal do card (nao no expand), chamar `onSelect` se disponivel
- Estilo visual diferente quando `isSelected` (borda primary)

#### 8. `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Adicionar estado `selectedResult` (AnalysisResult | null)
- Em telas >= lg, envolver em `grid grid-cols-[35%_1fr]`
- Coluna esquerda: filtros + lista de ScoreCards (scroll independente)
- Coluna direita: `FixtureDetailPanel` com `lay0x1Data` preenchido
- Ao clicar em um ScoreCard, setar `selectedResult`
- Em mobile: manter layout atual

#### 9. `src/components/Lay0x1/Lay0x1ScoreCard.tsx`

- Adicionar prop `onSelect?: () => void`
- Adicionar prop `isSelected?: boolean`
- Click no card principal chama `onSelect`
- Visual de selecionado (borda primary)

---

### Detalhes Tecnicos

**Performance:** O `usePreMatchAnalysis` so dispara quando o `fixtureId` muda. Ao selecionar outro jogo, os dados do anterior sao descartados e os novos carregam sob demanda. Nao ha pre-carregamento de todos os jogos.

**Responsividade:**
- `>= 1024px (lg)`: layout split com `grid grid-cols-[35%_1fr]`, ambas colunas com `overflow-y-auto` e `max-h-[calc(100vh-120px)]`
- `< 1024px`: layout single-column normal. No Planejamento, o click abre o PreMatchModal existente. No Lay 0x1, o click expande o card como hoje.

**Calculos Poisson** (MathAnalysisSection):
```text
P(k goals) = (lambda^k * e^(-lambda)) / k!
P(Over 1.5) = 1 - P(0) - P(1) usando lambda_total
P(BTTS) = (1 - e^(-lambda_home)) * (1 - e^(-lambda_away))
P(0x1) = e^(-lambda_home) * (lambda_away * e^(-lambda_away))
Odd Justa = 1 / P
```

**Dados usados:** Todos os dados vem do `usePreMatchAnalysis` existente (homeLastMatches, awayLastMatches, prediction, standings, etc.). Os calculos matematicos filtram os ultimos 20 jogos como mandante/visitante respectivamente.

---

### Sequencia de Implementacao

1. Criar `PreMatchPanel.tsx` (extrair conteudo do modal)
2. Criar `MathAnalysisSection.tsx` (calculos Poisson)
3. Criar `Lay0x1RiskPanel.tsx` (indicadores de risco)
4. Criar `FixtureDetailPanel.tsx` (composicao)
5. Modificar `GameListByLeague` e `GameListItem` (props de selecao)
6. Modificar `DailyPlanning.tsx` (layout split)
7. Modificar `Lay0x1ScoreCard` e `Lay0x1Scanner` (layout split)

### Nenhuma alteracao de backend
Todos os calculos matematicos sao feitos no frontend. Nenhuma migracao SQL, edge function ou chamada extra de API necessaria.
