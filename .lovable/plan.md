

## IA Evolutiva Real -- De Filtro Estatistico para Inteligencia Adaptativa

### Problemas Identificados

1. **Backtest NAO alimenta a calibracao**: O botao "Salvar para Calibracao" salva jogos no banco, mas NAO registra o resultado final (Green/Red) mesmo tendo o placar disponivel. Esses jogos ficam como "pendentes" e nunca entram na calibracao.

2. **Calibracao e puramente matematica**: A funcao `calibrate-lay0x1` apenas multiplica peso atual pela razao (taxa criterio / taxa media). Nao ha inteligencia artificial real analisando os padroes.

3. **Padroes detectados mas nao aplicados**: O sistema detecta ligas com mais Reds e faixas de odds fracas, mas NAO toma nenhuma acao automatica (nao bloqueia ligas, nao ajusta thresholds com base em padroes).

### Solucao em 3 Frentes

---

#### 1. Backtest com Auto-Resolucao Imediata

**Problema**: `saveBacktestForCalibration` salva jogos sem resultado.

**Correcao**: Ao salvar jogos do backtest, usar os dados de `final_score_home` e `final_score_away` que ja existem nos resultados do backtest para salvar o jogo JA RESOLVIDO no banco.

**Fluxo corrigido**:
- Para cada jogo aprovado do backtest que tem placar final:
  - Salvar com `final_score_home`, `final_score_away`, `was_0x1`, `result`, `resolved_at`
  - Jogo ja entra como "resolvido" no banco
- Apos salvar todos, verificar se atingiu multiplo de 30 jogos resolvidos
- Se sim, disparar calibracao automatica

**Arquivo**: `src/components/Lay0x1/Lay0x1Scanner.tsx` (funcao `saveBacktestForCalibration`)

---

#### 2. Calibracao com IA Real (Gemini)

**Problema**: A calibracao atual e uma formula fixa. Nao pensa, nao contextualiza, nao faz recomendacoes inteligentes.

**Solucao**: Adicionar uma fase de analise com IA (Gemini 2.5 Flash) na edge function `calibrate-lay0x1` que:

- Recebe todos os dados da calibracao (taxas por criterio, padroes detectados, historico de Reds, ligas problematicas)
- A IA analisa e retorna:
  - **Recomendacoes de ajuste de pesos** com justificativa (ex: "Reduzir peso Over de 22 para 16 porque a correlacao com sucesso caiu de 78% para 61%")
  - **Ligas para bloquear automaticamente** (se taxa Red > 50% com 3+ jogos)
  - **Ajustes de thresholds recomendados** com motivo
  - **Score minimo dinamico** recomendado com base no contexto geral
  - **Tendencias identificadas** (ex: "jogos com odd visitante > 3.8 tem 40% de Red")
  - **Resumo estrategico** em linguagem natural

- Os ajustes recomendados pela IA sao APLICADOS automaticamente (pesos, thresholds)
- Ligas recomendadas para bloqueio sao bloqueadas automaticamente
- Tudo e registrado no historico de calibracao com campo `ai_recommendations`

**Arquivo**: `supabase/functions/calibrate-lay0x1/index.ts`

**Novo campo no historico**: `ai_recommendations` (jsonb) na tabela `lay0x1_calibration_history`

---

#### 3. Acoes Automaticas sobre Padroes

**Problema**: Detecta "liga X tem 60% de Red" mas nao faz nada.

**Solucao**: Apos a IA analisar, o sistema executa acoes automaticas:

- **Auto-bloqueio de ligas**: Se taxa Red > 50% com 3+ jogos na liga, bloquear automaticamente e registrar motivo "auto_ia"
- **Score minimo dinamico**: Se taxa geral < 65%, elevar score minimo de 65 para 70 automaticamente (salvar no campo `min_score` em `lay0x1_weights`)
- **Alertas proativos**: Registrar no historico quais acoes foram tomadas automaticamente

**Arquivos**: `supabase/functions/calibrate-lay0x1/index.ts`, `supabase/functions/analyze-lay0x1/index.ts` (usar min_score dinamico)

---

### Detalhes Tecnicos

**Migration SQL**:
- Adicionar coluna `ai_recommendations` (jsonb, default '{}') na tabela `lay0x1_calibration_history`
- Adicionar coluna `min_score` (numeric, default 65) na tabela `lay0x1_weights`

**Edge Function `calibrate-lay0x1` -- Nova fase IA**:
- Apos calcular pesos e thresholds matematicamente, chamar Lovable AI (Gemini 2.5 Flash) com prompt estruturado contendo:
  - Taxas por criterio e taxa geral
  - Pesos atuais e novos calculados
  - Padroes detectados (ligas com Red, odds fracas)
  - Historico de ultimos 30 jogos com resultados
- A IA retorna via tool calling um JSON estruturado com recomendacoes
- Aplicar recomendacoes automaticamente (pesos, bloqueios de liga, score minimo)
- Salvar tudo no historico

**Edge Function `analyze-lay0x1` -- Score minimo dinamico**:
- Buscar `min_score` dos pesos do usuario
- Filtrar jogos com score abaixo do minimo dinamico (em vez do fixo 65)

**`Lay0x1Scanner.tsx` -- Backtest auto-resolve**:
- `saveBacktestForCalibration` agora salva jogos com resultado final incluso
- Dispara calibracao automatica ao atingir multiplo de 30

**`Lay0x1History.tsx` -- Exibir recomendacoes IA**:
- Novo card "Recomendacoes da IA" em cada ciclo de calibracao
- Mostrar acoes automaticas tomadas (ligas bloqueadas, score ajustado)

### Arquivos Modificados

- `supabase/functions/calibrate-lay0x1/index.ts` -- Adicionar chamada IA, auto-bloqueio de ligas, score minimo dinamico
- `supabase/functions/analyze-lay0x1/index.ts` -- Usar min_score dinamico do usuario
- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- Backtest salvar com resultado final + auto-calibracao
- `src/components/Lay0x1/Lay0x1History.tsx` -- Exibir recomendacoes IA no historico
- Migration SQL -- Adicionar colunas `ai_recommendations` e `min_score`

### Resultado Final

- Backtest alimenta a calibracao IMEDIATAMENTE com jogos ja resolvidos
- A cada 30 jogos, a IA (Gemini) analisa o contexto completo e faz recomendacoes inteligentes
- Ligas problematicas sao bloqueadas automaticamente pela IA
- Score minimo e ajustado dinamicamente conforme desempenho
- Toda decisao da IA fica registrada e auditavel na aba Historico IA
- O modelo evolui de verdade: nao e mais um filtro fixo, e uma IA que aprende com cada resultado

