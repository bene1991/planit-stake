

## Completar Modelo Evolutivo Bayesiano - Lacunas Pendentes

### Status Atual

A base do modelo ja esta implementada:
- Pesos iniciais (20/20/20/15/15/10) - OK
- Formula `novo_peso = peso_atual * (taxa_criterio / taxa_media)` - OK no `calibrate-lay0x1`
- Limites min=5, max=30 com rebalanceamento para 100 - OK
- Score = soma(criterio normalizado * peso adaptativo) - OK no `analyze-lay0x1`

### O que falta implementar

**1. Calibracao automatica a cada 30 jogos resolvidos**

Atualmente a calibracao so ocorre quando o usuario clica "Recalibrar Pesos" no Dashboard. O sistema deve disparar automaticamente apos cada resolucao de resultado quando `resolved_count % 30 === 0`.

Arquivo: `src/hooks/useLay0x1Analyses.ts`
- Apos `resolveAnalysis` com sucesso, contar jogos resolvidos
- Se `resolved_count % 30 === 0`, chamar `supabase.functions.invoke('calibrate-lay0x1')` automaticamente
- Mostrar toast informando que recalibracao automatica ocorreu

**2. Analise pos-Red com 0x1 (insights automaticos)**

Quando um resultado Red (0x1) e registrado, o sistema deve gerar insights textuais analisando qual criterio provavelmente falhou.

Arquivo: `src/hooks/useLay0x1Analyses.ts`
- Apos detectar `was_0x1 === true`, analisar o `criteria_snapshot` do jogo
- Gerar lista de insights, por exemplo:
  - "Visitante tinha odd alta: X.XX (fora da faixa ideal 2.5-4.0)"
  - "Over 1.5 combinado estava no limite: XX%"
  - "H2H tinha historico proximo do limite"
- Salvar insights no campo `criteria_snapshot` (adicionar chave `red_insights`)
- Exibir toast com resumo

Arquivo: `src/components/Lay0x1/Lay0x1Dashboard.tsx`
- Na secao de historico, quando `result === 'Red'`, exibir icone clicavel que mostra os insights do Red

**3. Rebalanceamento forcado a cada 100 jogos**

Arquivo: `supabase/functions/calibrate-lay0x1/index.ts`
- Adicionar logica: se `cycle_count % 10 === 0` (cada ciclo = 30 jogos, entao ciclo 3-4 ~ 100 jogos), aplicar rebalanceamento forcado
- Rebalanceamento forcado: puxa os pesos mais proximo dos defaults (media entre peso atual e default), evitando distorcao extrema

**4. Evolucao mensal e por liga no Dashboard**

Arquivo: `src/components/Lay0x1/Lay0x1Dashboard.tsx`
- Adicionar secao de evolucao mensal: agrupar analises por mes e mostrar win rate por mes
- Adicionar secao de evolucao por liga: agrupar por liga e mostrar win rate por liga
- Ambos com mini graficos de barras

**5. Historico de calibracoes na aba Config**

Arquivo: `src/components/Lay0x1/Lay0x1Evolution.tsx`
- Exibir historico de quando cada calibracao ocorreu
- Mostrar pesos antes/depois de cada calibracao (guardados no `weights_snapshot` das analises)

---

### Detalhes Tecnicos

**Alteracoes em `useLay0x1Analyses.ts`:**
- `resolveAnalysis`: apos update com sucesso, verificar se `resolved.length % 30 === 0`; se sim, invocar `calibrate-lay0x1`
- Se `was_0x1`, gerar insights localmente comparando `criteria_snapshot` com thresholds e salvar via update no `criteria_snapshot`

**Alteracoes em `calibrate-lay0x1/index.ts`:**
- Adicionar campo `forced_rebalance` na resposta
- Se `newCycleCount % 4 === 0` (aprox 120 jogos), aplicar anti-overfitting: `adjusted_weight = (current + default) / 2` antes da formula principal

**Alteracoes em `Lay0x1Dashboard.tsx`:**
- Nova secao "Evolucao Mensal" com tabela agrupada por ano-mes
- Nova secao "Performance por Liga" com tabela agrupada por liga
- Icone de info nos Reds que mostra insights

**Alteracoes em `Lay0x1Evolution.tsx`:**
- Exibir numero do ciclo atual e data da ultima calibracao (ja existe)
- Adicionar texto explicativo sobre o modelo bayesiano

### Resumo de Arquivos

**Modificados:**
- `src/hooks/useLay0x1Analyses.ts` (auto-calibracao + insights pos-Red)
- `src/components/Lay0x1/Lay0x1Dashboard.tsx` (evolucao mensal, por liga, insights Red)
- `src/components/Lay0x1/Lay0x1Evolution.tsx` (historico calibracoes, texto explicativo)
- `supabase/functions/calibrate-lay0x1/index.ts` (rebalanceamento forcado anti-overfitting)

