

## IA Especialista Lay 0x1 - Implementacao Completa

### Passo 1 - Criar tabelas no banco

Duas novas tabelas com RLS:

**`lay0x1_analyses`** - Historico de jogos analisados e resultados
- owner_id, fixture_id, home_team, away_team, league, date
- score_value (0-100), classification
- criteria_snapshot (jsonb), weights_snapshot (jsonb)
- final_score_home, final_score_away, was_0x1, result (Green/Red)
- resolved_at, created_at

**`lay0x1_weights`** - Pesos adaptativos por usuario
- owner_id (unique), pesos dos 6 criterios (default 20/20/20/15/15/10)
- Thresholds ajustaveis: min_home_goals_avg, min_away_conceded_avg, max_away_odd, min_over15_combined, max_h2h_0x1
- cycle_count, last_calibration_at

RLS: todas as operacoes restritas a `owner_id = auth.uid()`

### Passo 2 - Edge Function `analyze-lay0x1`

Recebe fixture IDs, para cada jogo:
1. Busca H2H via edge function `api-football` existente
2. Busca stats do mandante em casa e visitante fora
3. Aplica criterios de filtragem (usando thresholds do usuario)
4. Calcula score ponderado (0-100) com os pesos do usuario
5. Retorna lista de jogos aprovados/reprovados com detalhes

### Passo 3 - Edge Function `calibrate-lay0x1`

Disparada a cada 30 jogos resolvidos:
1. Calcula taxa de sucesso por criterio
2. Aplica formula: novo_peso = peso_atual * (taxa_criterio / taxa_media)
3. Limita entre 5 e 30, rebalanceia para somar 100
4. Salva novos pesos

### Passo 4 - Frontend

**Novos arquivos:**
- `src/pages/Lay0x1.tsx` - Pagina com 3 tabs (Scanner, Dashboard, Configuracoes)
- `src/components/Lay0x1/Lay0x1Scanner.tsx` - Busca jogos do dia, analisa, exibe aprovados/reprovados
- `src/components/Lay0x1/Lay0x1ScoreCard.tsx` - Score circular com breakdown
- `src/components/Lay0x1/Lay0x1Dashboard.tsx` - Equity, taxa de acerto, evolucao mensal
- `src/components/Lay0x1/Lay0x1Evolution.tsx` - Grafico de evolucao dos pesos
- `src/hooks/useLay0x1Weights.ts` - CRUD dos pesos
- `src/hooks/useLay0x1Analyses.ts` - CRUD das analises + metricas

**Arquivos modificados:**
- `src/App.tsx` - Nova rota `/lay-0x1`
- `src/components/BottomNav.tsx` - Link com icone Target
- `src/components/Layout.tsx` - Link no menu lateral

### Passo 5 - Registrar edge functions

Adicionar `analyze-lay0x1` e `calibrate-lay0x1` no `supabase/config.toml`

### Ordem de execucao

1. Migracao SQL (tabelas + RLS + indices)
2. Edge functions (analyze + calibrate)
3. Hooks (weights + analyses)
4. Componentes (Scanner, ScoreCard, Dashboard, Evolution)
5. Pagina + rotas + navegacao

