

## Corrigir Cache do Backtest -- Dados Historicos Nao Devem Expirar

### Problema

Quando voce fez o backtest de ontem e viu 12 jogos, depois saiu e voltou, o cache de 6 horas expirou e o sistema rodou uma nova analise automaticamente. A nova analise retornou 8 jogos porque a API pode ter retornado dados ligeiramente diferentes (odds atualizadas, fixtures modificados).

Para datas passadas (backtest), os resultados nao deveriam mudar -- uma vez analisados, deveriam ser guardados permanentemente.

### Solucao

1. **Cache permanente para backtest**: Datas passadas terao cache sem expiracao (TTL infinito). Apenas o dia de hoje mantem o TTL de 6 horas para permitir re-analise.

2. **Remover auto-fetch para backtest**: Quando trocar para uma data passada sem cache, NAO rodar analise automaticamente. Apenas exibir o botao "Backtest" para o usuario clicar quando quiser. Isso evita gastar creditos da API sem necessidade.

3. **Botao "Limpar Cache" visivel**: Adicionar opcao de limpar o cache de uma data especifica caso o usuario queira forcar nova analise.

### Detalhes Tecnicos

**Arquivo: `src/components/Lay0x1/Lay0x1Scanner.tsx`**

- Modificar `getCachedResults()`: se a data for anterior a hoje, ignorar o TTL (cache nunca expira)
- Modificar o `useEffect` de auto-fetch (linha 117-124): so fazer auto-fetch se for a data de hoje. Datas passadas nao disparam auto-fetch
- Adicionar botao discreto "Limpar cache" ao lado da data quando houver cache carregado, para permitir re-analise manual

**Funcao `getCachedResults` atualizada:**

```text
function getCachedResults(date, todayStr):
  raw = localStorage.getItem(key + date)
  if (!raw) return null
  { data, ts } = parse(raw)
  
  // Cache de backtest (datas passadas) nunca expira
  if (date < todayStr) return data
  
  // Cache de hoje expira em 6h
  if (Date.now() - ts > CACHE_TTL_MS) return null
  return data
```

**Auto-fetch condicional:**

```text
useEffect:
  if (autoFetchedRef.current === selectedDate) return
  if (selectedDate < todayStr) return  // NAO auto-fetch backtest
  if (!getCachedResults(selectedDate)) analyzeGames()
```

### Arquivos Modificados

- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- cache permanente para backtest, remover auto-fetch de datas passadas, botao limpar cache

