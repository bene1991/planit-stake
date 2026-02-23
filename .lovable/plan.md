
## IA Especialista Lay 0x1 - Plano de Implementacao

### Visao Geral

Sistema completo de analise inteligente para o mercado Lay 0x1, com scanner automatico de jogos, score ponderado, registro pos-jogo e modelo evolutivo que ajusta pesos dinamicamente.

---

### Arquitetura

O sistema sera composto por:

1. **Nova pagina** `/lay-0x1` com acesso via menu lateral/bottom nav
2. **Edge Function** `analyze-lay0x1` que busca dados da API-Football e calcula scores
3. **Tabelas no banco** para armazenar configuracoes de pesos, historico de analises e resultados
4. **Componentes React** para scanner, dashboard e configuracoes

---

### ETAPA 1 - Scanner de Jogos + Criterios

**Nova Edge Function: `supabase/functions/analyze-lay0x1/index.ts`**

Recebe uma lista de fixture IDs e para cada jogo:
- Busca H2H (ultimos 5 confrontos) via `fixtures/headtohead`
- Busca estatisticas do mandante em casa via `teams/statistics`
- Busca estatisticas do visitante fora via `teams/statistics`
- Busca odds do visitante via `odds` (endpoint ja existente)
- Calcula Over 1.5 % de cada time (usando ultimos jogos)

Criterios de filtragem (com valores default ajustaveis):
- Nenhum 0x1 nos ultimos 5 H2H
- Media gols marcados mandante em casa > 1.5
- Media gols sofridos visitante fora > 1.5
- Odd do visitante < 4.5
- Soma Over 1.5 % > 70%

**Novo componente: `src/components/Lay0x1/Lay0x1Scanner.tsx`**

- Carrega jogos do dia (reutiliza `useFixturesByDate`)
- Botao "Analisar" que envia fixtures para a edge function
- Exibe jogos aprovados/reprovados com detalhes dos criterios
- Painel de ajuste manual dos criterios (sliders/inputs)
- Mostra estatisticas usadas na decisao para cada jogo

---

### ETAPA 2 - Score Inteligente

Calculado na edge function para cada jogo aprovado:

| Criterio | Peso Inicial |
|---|---|
| Forca ofensiva mandante (media gols casa) | 20 |
| Fragilidade defensiva visitante (media gols sofridos fora) | 20 |
| Tendencia Over 1.5 combinada | 20 |
| Media de gols da liga | 15 |
| Historico H2H sem 0x1 | 15 |
| Faixa odds ideal (2.5-4.0 = max, fora = penalidade) | 10 |

Classificacao:
- Score >= 85: Muito Forte (badge verde)
- 75-84: Forte (badge azul)
- 65-74: Moderado (badge amarelo)
- < 65: Nao recomendado (badge vermelho)

**Novo componente: `src/components/Lay0x1/Lay0x1ScoreCard.tsx`**

Exibe score circular, classificacao, breakdown dos criterios com barras de progresso.

---

### ETAPA 3 - Registro Pos-Jogo

**Nova tabela: `lay0x1_analyses`**

```text
id: uuid (PK)
owner_id: uuid (FK auth.users)
fixture_id: text
home_team: text
away_team: text
league: text
date: text
score_value: numeric (0-100)
classification: text
criteria_snapshot: jsonb (valores dos criterios usados)
weights_snapshot: jsonb (pesos no momento da analise)
final_score_home: integer (nullable)
final_score_away: integer (nullable)
was_0x1: boolean (nullable)
result: text (nullable - Green/Red)
resolved_at: timestamptz (nullable)
created_at: timestamptz
```

**Nova tabela: `lay0x1_weights`**

```text
id: uuid (PK)
owner_id: uuid (FK auth.users)
offensive_weight: numeric (default 20)
defensive_weight: numeric (default 20)
over_weight: numeric (default 20)
league_avg_weight: numeric (default 15)
h2h_weight: numeric (default 15)
odds_weight: numeric (default 10)
min_home_goals_avg: numeric (default 1.5)
min_away_conceded_avg: numeric (default 1.5)
max_away_odd: numeric (default 4.5)
min_over15_combined: numeric (default 70)
max_h2h_0x1: integer (default 0)
cycle_count: integer (default 0)
last_calibration_at: timestamptz
created_at: timestamptz
updated_at: timestamptz
```

Ambas tabelas com RLS por `owner_id = auth.uid()`.

**Novo componente: `src/components/Lay0x1/Lay0x1Dashboard.tsx`**

- Taxa de acerto geral e por liga
- Grafico de equity (evolucao acumulada)
- % Greens / % Reds
- Evolucao mensal
- Tabela de jogos analisados com resultado

---

### ETAPA 4 - Modelo Evolutivo

**Nova Edge Function: `supabase/functions/calibrate-lay0x1/index.ts`**

Disparada automaticamente a cada 30 jogos resolvidos:

1. Busca todos os jogos resolvidos do usuario
2. Para cada criterio, calcula taxa de sucesso (Green) quando o criterio era forte vs fraco
3. Aplica formula: `novo_peso = peso_atual * (taxa_criterio / taxa_media)`
4. Limita pesos entre 5 e 30
5. Rebalanceia para somar 100
6. Salva novos pesos na tabela `lay0x1_weights`
7. A cada 100 jogos, faz rebalanceamento forcado

Analise pos-Red com 0x1:
- Verifica qual criterio falhou
- Gera insights textuais (ex: "Visitante tinha media ofensiva alta: 1.8 gols/jogo fora")
- Armazena no campo `criteria_snapshot` do registro

**Novo componente: `src/components/Lay0x1/Lay0x1Evolution.tsx`**

- Grafico de evolucao dos pesos ao longo do tempo
- Historico de calibracoes
- Insights de ajuste automatico

---

### Nova Pagina

**`src/pages/Lay0x1.tsx`**

Pagina com tabs:
- **Scanner**: Busca e analisa jogos do dia
- **Dashboard**: Metricas e graficos de performance
- **Configuracoes**: Ajuste manual de criterios e pesos

**Rota**: `/lay-0x1` adicionada em `App.tsx`

**Navegacao**: Adicionada ao `BottomNav.tsx` com icone `Target` do Lucide

---

### Hooks

- `src/hooks/useLay0x1Weights.ts` - CRUD dos pesos do usuario
- `src/hooks/useLay0x1Analyses.ts` - CRUD dos jogos analisados + metricas

---

### Consumo de API

Cada jogo analisado consome aproximadamente 4-5 chamadas da API-Football (H2H, stats mandante, stats visitante, fixture details). O sistema usa o cache L1/L2 ja existente na edge function `api-football` para minimizar chamadas repetidas. Para um dia com ~20 jogos filtrados por ligas favoritas, estimativa de ~80-100 chamadas (dentro da quota diaria de 75k).

---

### Resumo dos Arquivos

**Novos arquivos:**
- `src/pages/Lay0x1.tsx`
- `src/components/Lay0x1/Lay0x1Scanner.tsx`
- `src/components/Lay0x1/Lay0x1ScoreCard.tsx`
- `src/components/Lay0x1/Lay0x1Dashboard.tsx`
- `src/components/Lay0x1/Lay0x1Evolution.tsx`
- `src/hooks/useLay0x1Weights.ts`
- `src/hooks/useLay0x1Analyses.ts`
- `supabase/functions/analyze-lay0x1/index.ts`
- `supabase/functions/calibrate-lay0x1/index.ts`

**Arquivos modificados:**
- `src/App.tsx` (nova rota)
- `src/BottomNav.tsx` ou `Layout.tsx` (link de navegacao)
- `supabase/config.toml` (registrar novas edge functions)
- Migracao SQL (2 novas tabelas + RLS)
