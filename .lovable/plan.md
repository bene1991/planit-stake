

## Historico de Avaliacao da IA + Melhorias do Modelo Evolutivo

### O que ja existe

O sistema Lay 0x1 ja tem implementado:
- Scanner com 6 criterios eliminatorios e score ponderado 0-100
- Classificacao (Muito Forte, Forte, Moderado, Nao Recomendado)
- Salvamento automatico, auto-resolucao e analise pos-Red com IA (Gemini)
- Calibracao a cada 30 jogos com ajuste de pesos (limites 5-30) e thresholds
- Anti-overfitting a cada 4 ciclos
- Dashboard com equity, evolucao mensal, performance por liga
- Ligas bloqueadas e backtest acumulado

### O que falta implementar

#### 1. Nova tabela `lay0x1_calibration_history`

Armazena cada ciclo de calibracao com detalhes completos:

```text
Campos:
- id (uuid)
- owner_id (uuid)
- cycle_number (integer)
- trigger_type (text): "auto_30", "manual", "rebalance_100"
- total_analyses (integer)
- general_rate (numeric) -- taxa de acerto geral
- old_weights (jsonb)
- new_weights (jsonb)
- old_thresholds (jsonb)
- new_thresholds (jsonb)
- criterion_rates (jsonb) -- taxa de sucesso individual de cada criterio
- threshold_details (jsonb) -- detalhes de cada ajuste de threshold
- patterns_detected (jsonb) -- padroes identificados (ligas com mais Red, faixas de odds fracas)
- changes_summary (text[]) -- lista de alteracoes feitas
- forced_rebalance (boolean)
- created_at (timestamptz)
```

RLS: owner_id = auth.uid() para SELECT e INSERT.

#### 2. Atualizar Edge Function `calibrate-lay0x1`

Adicionar ao final da calibracao:
- **Salvar historico**: Inserir registro completo na nova tabela com pesos antigos, novos, taxas, padroes
- **Deteccao de padroes**: Calcular ligas com maior indice de Red, faixas de odds com pior desempenho, medias ofensivas que nao convertem
- **Liga auto-escalacao**: Se 2 Reds consecutivos na mesma liga, registrar alerta no historico
- **Score minimo dinamico**: Se taxa geral < 65%, registrar recomendacao de elevar score minimo

#### 3. Novo componente `Lay0x1History.tsx`

Painel de auditoria com as seguintes secoes:

**Resumo do Modelo Atual**
- Versao (ciclo atual)
- Taxa de acerto atual vs antes do ultimo ajuste
- Total de ajustes realizados
- ROI acumulado (Greens - Reds em unidades)

**Timeline de Calibracoes**
- Cards cronologicos mostrando cada ciclo
- Para cada ciclo: criterios fortalecidos, enfraquecidos, score minimo recomendado
- Delta visual (peso anterior -> novo peso) com setas coloridas

**Padroes Identificados**
- Ligas com maior indice de Red (top 5)
- Faixa de odds com menor desempenho
- Medias ofensivas que nao estao convertendo
- Tendencia Over artificial detectada

**Relatorio de Atualizacao do Modelo**
- Gerado a cada 30 jogos
- Criterios fortalecidos e enfraquecidos
- Mudanca estrategica aplicada

#### 4. Nova aba na pagina Lay0x1

Adicionar 4a aba "Historico IA" com icone `History` no `TabsList`, mudando de `grid-cols-3` para `grid-cols-4`.

### Detalhes Tecnicos

**Migration SQL:**
- Criar tabela `lay0x1_calibration_history` com RLS
- Policies: SELECT e INSERT para owner_id = auth.uid()

**Arquivos modificados:**
- `supabase/functions/calibrate-lay0x1/index.ts` -- salvar historico na nova tabela, detectar padroes (ligas com mais Red, faixas de odds fracas), registrar alertas de liga auto-escalacao
- `src/pages/Lay0x1.tsx` -- adicionar 4a aba "Historico IA"

**Arquivos novos:**
- `src/components/Lay0x1/Lay0x1History.tsx` -- componente completo do painel de auditoria
- `src/hooks/useLay0x1CalibrationHistory.ts` -- hook para buscar historico de calibracoes do banco

**Fluxo:**
1. A cada 30 jogos resolvidos, `calibrate-lay0x1` roda automaticamente
2. Alem de ajustar pesos/thresholds, insere registro detalhado em `lay0x1_calibration_history`
3. O registro inclui padroes detectados (ligas problematicas, faixas de odds, etc.)
4. A aba "Historico IA" exibe todos esses registros em formato de timeline auditavel

