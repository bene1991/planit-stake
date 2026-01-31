
## Plano: Otimização de API + Página de Fechamento Mensal

### Diagnóstico do Consumo de API

Após análise detalhada do código, identifiquei os seguintes pontos de consumo:

| Chamada | Frequência | Créditos/hora | Observação |
|---------|------------|---------------|------------|
| `live=all` (scores) | A cada 20s | ~180/hora | **Principal** - necessário |
| `get-fixture-details` | 1 por ciclo (jogos com gols) | ~180/hora | **Problema** - 3 chamadas API cada! |
| Backfill (jogos finalizados) | 1 por ciclo | ~180/hora | Desnecessário se já finalizado |
| Jogos começando em breve | 1 por ciclo | ~180/hora | Pode ser removido |
| ApiGameBrowser (por data) | Manual | Variável | OK - cache 10 min |

#### Problema Principal Identificado

O `get-fixture-details` faz **3 chamadas API em paralelo** por fixture (linha 392-401):
```typescript
const [fixtureRes, statsRes, eventsRes] = await Promise.all([
  fetch(`.../fixtures?id=${fixtureIdNum}`),      // 1 crédito
  fetch(`.../fixtures/statistics?fixture=...`),  // 1 crédito  
  fetch(`.../fixtures/events?fixture=...`),      // 1 crédito
]);
```

Com 90 jogos e atualização a cada 20s, se apenas 1 jogo tiver gol por ciclo:
- `live=all`: 180/hora
- `get-fixture-details`: 3 × 180 = **540/hora** (por 1 jogo com gol)

**Total potencial: 720+ créditos/hora** - esgota 7500 em ~10 horas

---

### Soluções de Otimização

#### 1. Desativar Busca de Detalhes Automática
O sistema já mostra placar pelo `live=all`. A busca de eventos (artilheiros) é extra e consome muito.

**Ação**: Remover a chamada `get-fixture-details` do loop de `useLiveScores` (linhas 219-247)

#### 2. Eliminar Fetches Individuais Desnecessários
- **Jogos que saíram do live=all** (linha 259): Limitar a 0 por ciclo
- **Jogos começando em breve** (linha 333): Limitar a 0 por ciclo
- **Backfill** (linha 362): Manter apenas 1 por ciclo (essencial)

#### 3. Intervalo Dinâmico Mais Agressivo
Quando não há jogos ao vivo, aumentar intervalo para 120s (não apenas 60s)

#### 4. Cache Mais Longo no Edge
Aumentar TTL do cache do `live=all` de 30s para 40s

---

### Estimativa Após Otimização

| Chamada | Frequência | Créditos/hora |
|---------|------------|---------------|
| `live=all` | A cada 20s | ~180/hora |
| Backfill | 1 por ciclo | ~180/hora |
| **Total** | | **~360/hora** |

Com 7500 créditos: **~20 horas de operação** (dia inteiro garantido)

---

### Parte 2: Página de Fechamento Mensal

Nova página `/monthly-report` com:

#### Funcionalidades

1. **Seletor de Mês/Ano**
   - Dropdown para escolher período
   - Botão "Fechar Mês" para gerar relatório final

2. **Resumo Estatístico Completo**
   - Total de operações
   - Greens / Reds
   - Win Rate geral
   - Lucro em R$ e Stakes
   - Drawdown máximo do mês
   - Maior sequência de greens/reds

3. **Comparativo com Mês Anterior**
   - Evolução do lucro
   - Mudança no win rate
   - Volume de operações

4. **Ranking de Métodos do Mês**
   - Tabela com performance de cada método
   - Ordenado por lucro ou win rate

5. **Análise IA do Mês** (novo)
   - Resumo narrativo gerado pela IA
   - Pontos positivos e negativos
   - Recomendações para o próximo mês
   - Score de saúde da banca no período

6. **Histórico de Fechamentos**
   - Lista de meses anteriores fechados
   - Possibilidade de revisar qualquer mês

#### Nova Tabela no Banco

```sql
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  year_month TEXT NOT NULL,  -- "2026-01"
  total_operations INTEGER,
  greens INTEGER,
  reds INTEGER,
  win_rate NUMERIC,
  profit_money NUMERIC,
  profit_stakes NUMERIC,
  max_drawdown NUMERIC,
  max_green_streak INTEGER,
  max_red_streak INTEGER,
  ai_score NUMERIC,
  ai_summary TEXT,
  ai_positive_points JSONB,
  ai_negative_points JSONB,
  ai_suggestions JSONB,
  closed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own reports" ON monthly_reports
  FOR ALL USING (auth.uid() = owner_id);

-- Índice único por usuário/mês
CREATE UNIQUE INDEX idx_monthly_reports_owner_month 
  ON monthly_reports(owner_id, year_month);
```

---

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useLiveScores.ts` | Remover chamadas extras de API |
| `supabase/functions/api-football/index.ts` | Aumentar TTL do cache |
| `src/pages/MonthlyReport.tsx` | **Novo** - Página de fechamento |
| `src/hooks/useMonthlyReport.ts` | **Novo** - Lógica de relatórios |
| `src/components/MonthlyReportCard.tsx` | **Novo** - Card de resumo |
| `src/components/MonthlyAIAnalysis.tsx` | **Novo** - Análise IA do mês |
| `src/App.tsx` | Adicionar rota `/monthly-report` |
| `src/components/Sidebar.tsx` | Adicionar link no menu |
| `src/components/BottomNav.tsx` | Avaliar se adiciona atalho |
| Migração SQL | Criar tabela `monthly_reports` |

---

### Fluxo de Uso

```
Usuário -> Página Fechamento Mensal -> Seleciona Janeiro 2026
                                    -> Vê estatísticas calculadas em tempo real
                                    -> Clica "Analisar com IA"
                                    -> Recebe insights detalhados
                                    -> Clica "Fechar Mês"
                                    -> Relatório é salvo permanentemente
                                    -> Aparece na lista de histórico
```

---

### Benefícios

1. **Economia de API**: De ~720/hora para ~360/hora = **50% menos consumo**
2. **Durabilidade**: 7500 créditos duram 20+ horas (dia inteiro)
3. **Registro Histórico**: Meses fechados ficam salvos para consulta
4. **Insights Mensais**: IA analisa padrões de longo prazo
5. **Accountability**: Força análise reflexiva ao final de cada mês
