

## Backtest Acumulado -- Atalhos de Periodo (7d, 15d, 30d)

### Problema Atual

Os botoes "-7d", "-15d", "-30d" apontam para uma data unica (ex: -7d vai para o dia 16/02 especificamente). O usuario quer ver o **acumulado** de todos os dias do periodo -- ex: "-7d" mostra o resumo combinado dos ultimos 7 dias.

### Solucao

Transformar os atalhos em **modo de periodo acumulado**. Ao clicar em "-7d", o sistema carrega os resultados cacheados de cada dia dos ultimos 7 dias, combina todos os jogos aprovados e exibe um resumo acumulado com Green, Red e Win Rate do periodo inteiro.

### Como Funciona

1. **Novo estado `rangeMode`**: Quando o usuario clica em um atalho de periodo (-7d, -15d, -30d), o scanner entra em modo de range. Os botoes "Ontem" e "Hoje" continuam funcionando como data unica.

2. **Agregar cache existente**: O sistema percorre todos os dias do periodo (ex: ultimos 7 dias) e coleta os resultados ja cacheados no localStorage. Dias sem cache ficam marcados como "nao analisados".

3. **Exibir resumo acumulado**: Card de resumo mostrando:
   - Total de dias no periodo
   - Dias ja analisados (com cache) vs dias faltando
   - Total de aprovados acumulado
   - Greens / Reds / Win Rate do periodo inteiro
   - Lista dos jogos aprovados de todos os dias combinados

4. **Analisar dias faltantes**: Botao "Analisar dias faltantes" que roda backtest apenas nos dias que ainda nao tem cache, sem tocar nos dias ja analisados.

5. **Manter input de data individual**: O input de data e os botoes "Ontem"/"Hoje" continuam selecionando um dia especifico como antes.

### Detalhes Tecnicos

**Arquivo: `src/components/Lay0x1/Lay0x1Scanner.tsx`**

- Adicionar estado `rangeMode: { label: string, days: number } | null`
- Mudar `dateShortcuts` para guardar `days` em vez de `date`:
  ```text
  rangeShortcuts = [
    { label: '7d', days: 7 },
    { label: '15d', days: 15 },
    { label: '30d', days: 30 },
  ]
  ```
- Ao clicar num shortcut de range, setar `rangeMode` e agregar resultados:
  ```text
  function getAggregatedResults(days):
    allResults = []
    analyzedDays = 0
    for i = 1..days:
      dateStr = format(subDays(today, i))
      cached = getCachedResults(dateStr)
      if cached:
        allResults.push(...cached)
        analyzedDays++
    return { results: allResults, analyzedDays, totalDays: days }
  ```
- `backtestStats` recalculado a partir dos resultados agregados
- Novo card de resumo do periodo mostrando dias analisados e metricas acumuladas
- Funcao `analyzeMissingDays` que itera sobre os dias sem cache e chama a API sequencialmente para cada dia faltante
- Ao clicar "Ontem", "Hoje" ou trocar data no input, sai do `rangeMode` e volta ao modo dia unico

### Resultado Visual

Botoes ficam:
```text
[Ontem] [7d] [15d] [30d] [Hoje]
```

Ao clicar em "7d", mostra:
```text
Periodo: Ultimos 7 dias (5/7 analisados)
[Analisar 2 dias faltantes]

Acumulado: 18 Aprovados | 15 Green | 3 Red | 83% Win Rate
```

E abaixo, os cards dos jogos aprovados de todos os dias.

### Arquivos Modificados

- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- adicionar modo range, agregar cache multi-dia, card de resumo acumulado

