

## Auditoria Completa: Metricas, Graficos e Informacoes entre Abas

Apos revisar todas as 5 abas (Planejamento, Desempenho, Banca, Analise de Metodo, Mensal), identifiquei duplicacoes, informacoes pouco relevantes e lacunas importantes.

---

### DUPLICACOES ENCONTRADAS

| Metrica | Onde aparece | Problema |
|---------|-------------|----------|
| **Win Rate** | Desempenho (card KPI + card comparacao + GreenVsRedChart) + Mensal (card) + Analise de Metodo (por metodo) + Planejamento (resumo do dia) | O card de comparacao "Win Rate vs periodo anterior" repete o card KPI principal. O GreenVsRedChart tambem e redundante com o card de Greens/Reds |
| **Ranking de Metodos** | Desempenho (MethodsRankingTable por Combined Score) + Mensal (MonthlyMethodRanking por lucro) + Analise de Metodo (cards individuais) | 3 rankings diferentes com criterios diferentes. Confuso |
| **Lucro Hoje** | Planejamento (card "Lucro Hoje") + Desempenho (card "Lucro Hoje") | Exatamente o mesmo dado em 2 abas |
| **Drawdown Maximo** | Desempenho (card KPI "Pico/DD") + Desempenho (AdvancedMetrics "Drawdown Maximo") + Mensal (card "Drawdown Max") | O card KPI "Pico/DD" e o AdvancedMetrics "Drawdown Maximo" estao na mesma pagina |
| **Maior Lucro / Maior Prejuizo** | Desempenho (AdvancedMetricsCards) + Desempenho (ProfitDonutCharts) | Ambos mostram maxProfit e maxLoss na mesma pagina, sendo que os donuts repetem os valores dos cards |
| **Melhor Metodo** | Desempenho (card comparacao "Melhor Metodo") + Mensal (card "Melhor Metodo") | Mesmo dado com escopo diferente, mas sem deixar claro |
| **Performance por Liga** | Desempenho (LeagueStatsChart + LeagueRankingByMethod) + Analise de Metodo (por liga dentro de cada metodo) | LeagueStatsChart e LeagueRankingByMethod sao similares |

---

### INFORMACOES POUCO RELEVANTES OU CONFUSAS

1. **GreenVsRedChart (Desempenho)** - Um grafico de pizza apenas com Greens vs Reds. Essa informacao ja esta no card KPI de Win Rate (ex: "65% - 42G / 23R"). O grafico nao adiciona valor
2. **ProfitDonutCharts (Desempenho)** - Os 3 donuts sao confusos:
   - "Maior Lucro" mostra "% do lucro total" - pouco acionavel
   - "Maior Prejuizo" mostra "% do prejuizo total" - mesma coisa
   - O card "Resumo" no meio repete Dias, Operacoes, Media/Dia e Media/Op que ja estao em outros cards
3. **Card KPI "Pico/DD" em stakes** - Duplica o AdvancedMetrics "Drawdown Maximo" que ja esta em R$. Ter os dois e redundante
4. **Card de comparacao "Volume"** - Mostra volume vs periodo anterior, mas o volume ja esta no subtitulo da pagina e no card de Win Rate

---

### INFORMACOES RELEVANTES QUE FALTAM

1. **ROI (Return on Investment)** - Nao aparece na pagina de Desempenho. So existe na Analise de Metodo individual. E uma metrica essencial para traders
2. **Lucro em Stakes no periodo** - Existe no card KPI, mas falta no AdvancedMetricsCards e nos graficos. O usuario opera em stakes, seria util ter run-up/drawdown tambem em stakes
3. **Streak atual** - Aparece no Status Card do Desempenho, mas nao aparece no Planejamento diario (onde o usuario mais precisa saber se esta numa sequencia negativa)
4. **Evolucao da banca real** - A pagina de Banca nao tem NENHUM grafico ou historico. So gerencia metodos. Falta mostrar como a banca evolui ao longo do tempo
5. **Comissao utilizada nos calculos** - Nao e visivel em nenhuma aba. O usuario nao sabe qual taxa de comissao esta sendo aplicada
6. **Breakeven Rate** - Aparece apenas como texto pequeno no card "Odd Media". Deveria ser mais proeminente pois e crucial para o trader

---

### PLANO DE ACOES RECOMENDADAS

**Prioridade Alta - Remover duplicacoes:**

1. **Remover GreenVsRedChart** da pagina de Desempenho - informacao ja coberta pelo card KPI
2. **Remover ProfitDonutCharts** - confuso e redundante. Os dados de "Maior Lucro" e "Maior Prejuizo" ja estao nos AdvancedMetricsCards
3. **Remover card KPI "Pico/DD"** - ja coberto pelo AdvancedMetricsCards com mais detalhes
4. **Remover card de comparacao "Volume"** - pouco util, informacao ja presente em outros lugares

**Prioridade Media - Adicionar informacoes faltantes:**

5. **Adicionar ROI** como card KPI na pagina de Desempenho (ROI = Lucro Total / Total Apostado * 100)
6. **Mover Streak atual** do Status Card para o resumo do dia no Planejamento (onde e mais acionavel)
7. **Adicionar Breakeven Rate** de forma mais visivel, junto ao Win Rate

**Prioridade Baixa - Melhorias:**

8. **Simplificar LeagueStatsChart + LeagueRankingByMethod** - consolidar em um unico componente com toggle
9. **Adicionar mini grafico de evolucao** na pagina de Banca

---

### DETALHES TECNICOS

**Arquivos a modificar:**

- `src/pages/Performance.tsx` - Remover imports e uso de GreenVsRedChart, ProfitDonutCharts, card "Pico/DD", card comparacao "Volume". Adicionar card ROI
- `src/components/Charts/GreenVsRedChart.tsx` - Pode ser deletado ou mantido para uso futuro
- `src/components/ProfitDonutCharts.tsx` - Pode ser deletado
- `src/pages/DailyPlanning.tsx` - Adicionar streak atual no resumo do dia

**Arquivos que NAO mudam:**
- MonthlyReport.tsx - O ranking mensal tem proposito diferente (fechamento)
- MethodAnalysis.tsx - Analise individual e complementar, nao duplicada
- BankrollManagement.tsx - Gestao de metodos continua como esta

