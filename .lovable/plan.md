
## Adicionar Grafico de Evolucao da Banca na pagina de Gestao de Banca

### Contexto
O grafico de evolucao da banca (`BankrollEvolutionChart`) ja existe como componente e ja e usado na pagina de Desempenho. Os dados sao gerados pelo hook `useFilteredStatistics`. Porem a pagina de Banca (`/bankroll`) nao mostra nenhum historico visual - apenas gestao de metodos.

### O que sera feito

Adicionar o grafico de evolucao da banca na pagina de Gestao de Banca, mostrando como a banca evoluiu ao longo do tempo com base nas operacoes registradas. O grafico ficara logo abaixo do card de "Valor Total da Banca".

### Alteracoes tecnicas

**`src/pages/BankrollManagement.tsx`**:

1. Importar o hook `useFilteredStatistics` para obter os dados de `bankrollEvolution`
2. Importar o componente `BankrollEvolutionChart`
3. Importar o hook `useSupabaseGames` (dependencia de `useFilteredStatistics`) e `useSettings`
4. Chamar o hook com os jogos do usuario (sem filtros, para mostrar evolucao completa)
5. Renderizar o `BankrollEvolutionChart` entre o card do valor total e a barra de alocacao

O grafico mostrara a evolucao acumulada em R$ de todas as operacoes, dando ao usuario visibilidade de como sua banca cresceu ou diminuiu ao longo do tempo, diretamente na pagina onde ele gerencia o capital.
