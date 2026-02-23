

## Dashboard Lay 0x1 -- Correcoes e Melhorias Completas

### 1. Corrigir Jogos Duplicados no Dashboard

**Problema**: Quando o scanner roda a analise novamente (ex: clicou "Analisar" duas vezes), ele salva jogos aprovados que ja existem no banco. Ja existem duplicatas reais no banco de dados (ex: Brondby vs Sonderjyske aparece 2x, Lechia vs Zaglebie 3x).

**Solucao**:
- **Prevenir futuros duplicados**: Adicionar constraint `UNIQUE(owner_id, fixture_id)` na tabela `lay0x1_analyses` via migration SQL, com `ON CONFLICT DO NOTHING` no insert
- **Limpar duplicatas existentes**: Migration SQL que deleta registros duplicados mantendo o mais antigo
- **Frontend**: Adicionar `ON CONFLICT` no `saveAnalysis` do hook `useLay0x1Analyses.ts`

### 2. Analise Pos-Red com IA Completa

**Problema atual**: A analise pos-Red e apenas uma funcao local (`generateRedInsights`) com regras fixas simples. Nao usa IA de verdade.

**Solucao**: Criar uma analise pos-Red enriquecida usando a IA (Gemini) via edge function que:
- Recebe os dados do jogo (criterios, odds, medias, H2H, liga)
- Analisa por que o 0x1 aconteceu apesar dos criterios aprovados
- Gera insights acionaveis: padrao da liga, horario do gol, fraquezas nao capturadas
- Sugere se a liga deve ser removida ou os thresholds ajustados

**Implementacao**:
- Nova edge function `analyze-red-lay0x1` que usa Lovable AI (Gemini 2.5 Flash)
- Chamada automaticamente quando um jogo e resolvido como Red (0x1)
- Resultado salvo no `criteria_snapshot.ai_red_analysis` do registro
- Dashboard exibe a analise completa da IA em um card expandivel ao lado do jogo Red

### 3. Usar Resultados do Backtest para Calibracao

**Problema**: O backtest gera dados valiosos (aprovados vs Green/Red), mas esses dados nao sao salvos no banco para calibracao. Somente jogos do dia de hoje sao salvos.

**Solucao**: Adicionar botao "Salvar para Calibracao" no modo backtest acumulado que:
- Salva os jogos aprovados do backtest na tabela `lay0x1_analyses` (com `ON CONFLICT DO NOTHING` para evitar duplicatas)
- Dispara auto-resolucao imediata (jogos passados ja tem placar final disponivel)
- Permite que a calibracao use esses dados historicos

### 4. Excluir Jogos Adiados/Cancelados do Dashboard

**Problema**: Jogos adiados ficam como "Pendentes" eternamente no dashboard sem opcao de remover.

**Solucao**:
- Adicionar botao de excluir (icone lixeira) em cada jogo pendente no Dashboard
- Nova funcao `deleteAnalysis` no hook `useLay0x1Analyses.ts`
- Confirmacao simples antes de excluir

### 5. Lista de Ligas Bloqueadas (Blacklist)

**Problema**: Algumas ligas nao estao disponiveis na casa de apostas do usuario, ou tem performance ruim. O scanner continua mostrando jogos dessas ligas.

**Solucao**:
- Nova tabela `lay0x1_blocked_leagues` com campos: `owner_id`, `league_name`, `reason` (nao_disponivel, performance_ruim), `created_at`
- No Dashboard, botao "Bloquear Liga" ao lado de cada liga na secao "Performance por Liga" e nos jogos pendentes
- No Scanner (edge function `analyze-lay0x1`), filtrar jogos de ligas bloqueadas ANTES da analise detalhada
- Na aba Config (Lay0x1Evolution), nova secao "Ligas Bloqueadas" com lista e botao para desbloquear

### Detalhes Tecnicos

**Migration SQL**:

```text
-- 1. Remove duplicates (keep oldest)
DELETE FROM lay0x1_analyses a
USING lay0x1_analyses b
WHERE a.owner_id = b.owner_id
  AND a.fixture_id = b.fixture_id
  AND a.created_at > b.created_at;

-- 2. Add unique constraint
ALTER TABLE lay0x1_analyses
  ADD CONSTRAINT unique_owner_fixture UNIQUE (owner_id, fixture_id);

-- 3. Create blocked leagues table
CREATE TABLE lay0x1_blocked_leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  league_name text NOT NULL,
  reason text NOT NULL DEFAULT 'nao_disponivel',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, league_name)
);

ALTER TABLE lay0x1_blocked_leagues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own blocked leagues" ON lay0x1_blocked_leagues FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own blocked leagues" ON lay0x1_blocked_leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can delete own blocked leagues" ON lay0x1_blocked_leagues FOR DELETE USING (auth.uid() = owner_id);
```

**Arquivos novos**:
- `supabase/functions/analyze-red-lay0x1/index.ts` -- Edge function de analise pos-Red com IA
- `src/hooks/useLay0x1BlockedLeagues.ts` -- Hook para gerenciar ligas bloqueadas

**Arquivos modificados**:
- `src/hooks/useLay0x1Analyses.ts` -- Adicionar `deleteAnalysis`, usar `upsert` com `onConflict`, chamar analise pos-Red com IA
- `src/components/Lay0x1/Lay0x1Dashboard.tsx` -- Botao excluir em pendentes, botao bloquear liga, card expandivel de analise IA pos-Red, deduplicacao visual
- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- Botao "Salvar para Calibracao" no backtest, filtrar ligas bloqueadas dos resultados
- `src/components/Lay0x1/Lay0x1Evolution.tsx` -- Secao "Ligas Bloqueadas" com lista e botao desbloquear
- `supabase/functions/analyze-lay0x1/index.ts` -- Buscar ligas bloqueadas do usuario e filtrar antes da analise

### Resultado Final

- Dashboard sem duplicatas
- Jogos adiados podem ser excluidos
- Analise pos-Red completa pela IA com insights profundos
- Backtest alimenta a calibracao automaticamente
- Ligas indesejaveis sao bloqueadas e nao aparecem mais no scanner

