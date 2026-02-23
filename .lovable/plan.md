
## Correcao do erro na aba Gols

### Problema
O componente `GoalStatsSection` crasha com `Cannot read properties of undefined (reading 'played')` porque `homeStats.games` pode ser `undefined`. A verificacao na linha 162 so checa se `homeStats` existe, mas nao se `homeStats.games` existe.

### Causa raiz
A API retorna `homeStats` como objeto, porem a propriedade `games` pode nao estar presente na resposta. O codigo usa `homeStats!.games.played.total` sem verificar se `games` existe.

### Solucao

**Arquivo: `src/components/PreMatchAnalysis/GoalStatsSection.tsx`**

1. Melhorar a guarda inicial (linha 162) para tambem verificar se `games` existe:
```
if (isSeasonMode && (!homeStats?.games?.played || !awayStats?.games?.played)) {
  return <p ...>Estatisticas indisponiveis</p>;
}
```

2. Usar optional chaining em todos os acessos a `homeStats.games` e `awayStats.games`:
   - Linha 166: `homeStats?.games?.played?.total` (ja esta ok)
   - Linha 209-210: Trocar `homeStats!.games.played.total` por `homeStats?.games?.played?.total ?? 0`
   - Linha 267-268: Ja usa optional chaining (ok)

3. Proteger tambem os acessos a `goals`, `clean_sheet`, `failed_to_score` com optional chaining, pois qualquer propriedade pode vir undefined da API.

### Mudancas especificas

- Linha 162: Alterar guarda para `(!homeStats?.goals || !awayStats?.goals)` - isso garante que se qualquer dado essencial faltar, mostra "indisponivel"
- Linhas 207-210: Trocar `!` por `?.` e adicionar fallbacks `?? 0`
- Linhas 238-246: Mesma protecao com optional chaining
- Linha 166: Manter como esta (ja seguro)
