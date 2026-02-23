

## Corrigir Re-analise Automatica -- Nunca Sobrescrever Resultados Existentes

### Problema

Toda vez que o usuario sai da pagina e volta, o componente remonta e o `autoFetchedRef` reseta para `null`. Isso faz o segundo `useEffect` (auto-fetch) rodar novamente, chamando a API mesmo quando ja havia cache. Alem disso, o cache de hoje expira em 6 horas, e a API pode retornar resultados diferentes (3 jogos virando 2, 12 virando 8).

### Solucao

Remover completamente o auto-fetch. O scanner so deve buscar jogos quando o usuario clicar no botao "Analisar" ou "Backtest" manualmente. O cache fica permanente para TODAS as datas (hoje, ontem, qualquer data). So e limpo quando o usuario clica em "Limpar cache".

### Detalhes Tecnicos

**Arquivo: `src/components/Lay0x1/Lay0x1Scanner.tsx`**

1. **Remover o segundo `useEffect` de auto-fetch** (linhas 119-128) -- eliminar completamente. Nunca mais rodar analise automatica.

2. **Remover TTL do cache** -- o cache nunca expira para nenhuma data. Tanto `getCachedResults` quanto `getCachedMeta` deixam de verificar timestamp. O cache so e removido manualmente via botao "Limpar cache".

3. **Simplificar `getCachedResults`** -- apenas ler do localStorage sem verificar expiracao:
```text
function getCachedResults(date):
  raw = localStorage.getItem(key + date)
  if (!raw) return null
  return JSON.parse(raw).data
```

4. **Simplificar `getCachedMeta`** -- mesma logica, sem TTL.

5. **Remover `autoFetchedRef`** -- nao e mais necessario pois nao existe auto-fetch.

6. **Manter o `useEffect` de carregamento de cache** (linhas 106-117) -- apenas carrega do cache quando troca de data, sem disparar fetch.

### Resultado

- Entrou na pagina com cache existente: mostra os resultados salvos, sem chamar API
- Entrou na pagina sem cache: mostra vazio, usuario clica no botao para analisar
- Clicou "Limpar cache": limpa os resultados, usuario pode re-analisar
- Clicou "Analisar"/"Backtest": busca da API e salva no cache

### Arquivos Modificados

- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- remover auto-fetch, remover TTL do cache, simplificar logica
