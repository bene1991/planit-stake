

## Corrigir Backtest 90 Dias -- Odds Indisponiveis em Datas Antigas

### O Problema (confirmado nos logs)

Os logs do backend confirmam que para datas com mais de ~30 dias, o endpoint de odds em massa retorna **0 resultados**:

```
[ODDS] Total: 1 pages, 0 fixtures with odds
[SCANNER] Fixtures with odds data: 0/204
[SCANNER] Pre-filtered (odds criteria): 0
```

O scanner depende do endpoint `odds?date=YYYY-MM-DD` para buscar odds de todos os jogos de uma vez. Porem, a API-Football so mantem odds em massa para datas recentes (~30 dias). Para datas mais antigas, as odds so estao disponiveis via `odds?fixture=ID` (por jogo individual).

Como o pre-filtro exige odds para continuar (`if (!odds || odds.homeOdd <= 0) continue`), todos os jogos de datas antigas sao descartados.

### A Solucao

Quando o endpoint de odds em massa retorna 0 resultados, usar uma estrategia de fallback:

1. **Primeiro**: Tentar odds em massa (atual, funciona para <30 dias)
2. **Se retornar 0**: Pre-filtrar fixtures usando dados do proprio endpoint `fixtures` (que inclui status, gols, etc.) e buscar odds individualmente por fixture para os candidatos mais promissores
3. **Otimizacao**: Limitar a busca individual de odds a fixtures que ja passam nos criterios basicos (liga nao bloqueada, jogo finalizado com placar disponivel)

### Detalhes Tecnicos

**Arquivo**: `supabase/functions/analyze-lay0x1/index.ts`

**Mudanca na funcao `serve`** (apos a chamada `fetchAllOddsPages`):

Quando `oddsMap.size === 0` e a data e passada:

1. Filtrar fixtures por ligas nao bloqueadas
2. Para cada fixture candidata, buscar odds individualmente via `odds?fixture=ID` em lotes paralelos de 5
3. Aplicar o mesmo pre-filtro de odds (home < away, away <= max)
4. Continuar o fluxo normal de analise detalhada

**Limite de seguranca**: Buscar odds individuais para no maximo 80 fixtures por dia (para nao estourar a cota da API). Priorizar fixtures ja finalizadas (FT) para backtest.

**Codigo conceitual**:
```text
if (oddsMap.size === 0 && isHistorical) {
  // Filtrar fixtures finalizadas de ligas nao bloqueadas
  const candidates = allFixtures.filter(f =>
    ['FT','AET','PEN'].includes(f.fixture?.status?.short) &&
    !blockedLeagues.has(f.league?.name)
  ).slice(0, 80);

  // Buscar odds em lotes paralelos de 5
  for (batch of candidates) {
    const oddsData = await callApiFootball('odds', { fixture: f.fixture.id });
    // Extrair e adicionar ao oddsMap
  }
}
```

### Resultado

- Backtest de 90 dias vai encontrar jogos em TODAS as datas, nao apenas nos ultimos ~30 dias
- O fallback so e ativado quando odds em massa retornam vazio (sem impacto no fluxo normal)
- Limite de 80 fixtures/dia protege a cota da API
- Tempo de analise por dia pode aumentar um pouco (~10-15s por dia antigo), mas o resultado sera completo

### Arquivos Modificados

- `supabase/functions/analyze-lay0x1/index.ts` -- Adicionar fallback de odds individuais quando odds em massa retornam vazio

