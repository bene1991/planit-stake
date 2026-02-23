

## Corrigir Scanner Lay 0x1 - Paginacao de Odds

### Problema Identificado

O endpoint `odds` da API-Football retorna resultados **paginados** (tipicamente 20 por pagina). Quando ha 1500+ jogos no dia, apenas ~20 recebem dados de odds. O pre-filtro na linha 178 do `analyze-lay0x1/index.ts` descarta todos os jogos sem odds:

```
if (!odds || odds.homeOdd <= 0 || odds.awayOdd <= 0) continue;
```

Resultado: 0 jogos passam no filtro, mesmo com 1500+ jogos disponiveis.

### Solucao

**Arquivo: `supabase/functions/analyze-lay0x1/index.ts`**

1. **Buscar TODAS as paginas de odds**: A resposta da API inclui `paging.total` (total de paginas) e `paging.current`. Fazer loop buscando paginas 1, 2, 3... ate `paging.total`.

2. **Processar em lote com concorrencia limitada**: Para nao sobrecarregar a API, buscar 3 paginas em paralelo por vez.

3. **Adicionar logs de debug**: Logar quantos jogos totais, quantos com odds encontradas, e quantos passaram no pre-filtro — para facilitar debug futuro.

4. **Limitar analise detalhada**: Apos pre-filtro de odds, limitar a no maximo ~50 jogos para analise completa (H2H + stats), evitando timeout da edge function.

### Detalhes Tecnicos

Modificar a funcao `callApiFootball` ou criar helper `fetchAllOddsPages`:

```text
async function fetchAllOddsPages(date: string): Map<number, odds>
  1. Chamar odds?date=YYYY-MM-DD (page 1)
  2. Ler paging.total da resposta
  3. Para pages 2..total, buscar em lotes de 3
  4. Consolidar todos os resultados no oddsMap
  return oddsMap
```

Adicionar `console.log` em pontos chave:
- Total fixtures encontrados
- Total paginas de odds
- Total fixtures com odds
- Total que passaram pre-filtro
- Total analisados em detalhe

Adicionar limite de seguranca: se pre-filtro retorna > 50 jogos, pegar os 50 com melhor relacao home_odd/away_odd (maior diferenca = mandante mais favorito).

### Arquivo Modificado

- `supabase/functions/analyze-lay0x1/index.ts`

