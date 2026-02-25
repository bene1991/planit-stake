

## Plano: Correções e Melhorias Lay 0x1 + Telegram + Dashboard

### Problemas identificados e soluções

---

### 1. Scanner: jogos somem depois de carregar (BUG CRITICO)

**Causa raiz:** No `Lay0x1Scanner.tsx`, o `useEffect` na linha 193 roda sempre que `selectedDate` ou `rangeMode` mudam. Porem, o `analyzeGames` faz `setResults(analysisResults)` e salva no cache. Logo apos, o `useEffect` dispara novamente (por depender de `selectedDate`) e recarrega do cache. Porem, se o `analyses` (do hook `useLay0x1Analyses`) atualiza apos o `saveAnalysis`, isso causa re-render e pode limpar o estado.

O problema real esta no fluxo: `analyzeGames` chama `saveAnalysis` que atualiza o estado `analyses`, causando re-render do componente. Como `analyzeGames` depende de `analyses` no `useCallback` (linha 390), isso recria a funcao. Mas o `useEffect` de cache (linha 193) executa novamente e pode sobrescrever.

**Solucao:** Adicionar uma ref `isAnalyzingRef` para impedir que o `useEffect` de cache sobrescreva resultados durante/apos a analise. Quando `analyzeGames` esta rodando ou acabou de rodar, o effect nao deve limpar os resultados.

**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

---

### 2. Enviar jogos do Lay 0x1 para o Telegram

**O que falta:** Botao no Scanner para enviar os jogos aprovados do dia para o Telegram.

**Solucao:**
- Adicionar botao "Enviar Telegram" no Scanner, visivel quando ha resultados aprovados e nao esta em modo backtest/range
- Reutilizar a logica de envio direto pela API do Telegram (igual ao `TelegramPlanningMessage`)
- Buscar config do Telegram do hook `useSettings`
- Formatar mensagem especifica para Lay 0x1 com os jogos aprovados

**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

---

### 3. Escolher metodo no Telegram do Planejamento

**Situacao atual:** O `TelegramPlanningMessage` filtra APENAS jogos com metodo "Lay 0x1" ou "Lay 1x0" (hardcoded na funcao `buildTelegramGames`, linha 27).

**Solucao:**
- Adicionar um seletor de metodo dentro do modal `TelegramPlanningMessage`
- Em vez de filtrar por nomes fixos, permitir que o usuario escolha qual(is) metodo(s) incluir na mensagem
- Opcao "Todos os metodos" como padrao

**Arquivo:** `src/components/TelegramPlanningMessage.tsx`

---

### 4. Dashboard: usar dados reais a partir de ontem (nao backtest)

**Situacao atual:** O Dashboard (`Lay0x1Dashboard`) ja usa dados da tabela `lay0x1_analyses` (jogos salvos automaticamente pelo scanner). Os jogos do backtest tambem sao salvos la quando o usuario clica "Salvar para Calibracao".

**O que o usuario quer:** Que o dashboard considere APENAS jogos a partir de ontem (reais, nao backtest antigo).

**Solucao:**
- No `Lay0x1Dashboard`, filtrar `analyses` para incluir apenas jogos com `date >= ontem` nos calculos de metricas e graficos
- Remover dados de backtest antigos dos KPIs (filtrar por data)
- Adicionar um filtro de periodo no dashboard (similar ao historico do planejamento)

**Arquivo:** `src/components/Lay0x1/Lay0x1Dashboard.tsx`

---

### 5. Dashboard: "Resultados do dia" mostra 1 quando deveria ser 4

**Causa:** O `dailyData` na linha 68 filtra por `resolvedAnalyses` que ja exclui "Nao recomendado". Porem, o grafico de "Resultados por Dia" conta corretamente. O problema pode ser que os 4 jogos nao foram resolvidos (sem `result`), ou que a classificacao ficou como "Nao recomendado".

**Solucao:** Verificar e corrigir o filtro `resolvedAnalyses` (linha 30) para incluir todos os jogos resolvidos, independente da classificacao. Jogos adicionados manualmente que foram aprovados depois devem aparecer. Alem disso, ordenar os jogos resolvidos por data.

**Arquivo:** `src/components/Lay0x1/Lay0x1Dashboard.tsx`

---

### 6. Dashboard: ordenar historico por dia e melhorar organizacao

**Solucao:**
- No historico de jogos resolvidos, agrupar por data (similar ao historico do Planejamento)
- Mostrar header com a data e os jogos daquele dia abaixo
- Ordenar do mais recente para o mais antigo

**Arquivo:** `src/components/Lay0x1/Lay0x1Dashboard.tsx`

---

### 7. Dashboard: contagem de Greens/Reds incorreta

**Causa:** O `filteredMetrics` (linha 33) filtra `analyses.filter(a => a.classification !== 'Nao recomendado')`. Se jogos foram adicionados com classificacao errada ou se o backtest inflou os numeros, os totais ficam errados.

**Solucao:**
- Aplicar filtro de data (a partir de ontem) nos KPIs
- Verificar se `resolvedAnalyses` esta contando corretamente apenas jogos com `result` preenchido
- Garantir que jogos duplicados nao inflem a contagem

**Arquivo:** `src/components/Lay0x1/Lay0x1Dashboard.tsx`

---

### Resumo dos arquivos a editar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/Lay0x1/Lay0x1Scanner.tsx` | Fix bug de jogos sumindo (ref guard) + botao Telegram |
| `src/components/TelegramPlanningMessage.tsx` | Seletor de metodo para o Telegram |
| `src/components/Lay0x1/Lay0x1Dashboard.tsx` | Filtro de data (a partir de ontem), fix contagens, agrupar historico por dia, ordenacao |

### Nenhuma mudanca de backend necessaria
Todas as correcoes sao no frontend. Nao ha necessidade de migracoes SQL ou edge functions.

