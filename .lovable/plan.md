

## Auto-Save e Auto-Resolucao dos Jogos Lay 0x1

### Problema Atual

O fluxo atual exige 2 acoes manuais:
1. Clicar "Salvar" em cada jogo aprovado no Scanner
2. Digitar o placar final manualmente no Dashboard para resolver

### Solucao Proposta

**1. Auto-save dos jogos aprovados apos o scan**

Quando o scanner terminar a analise, todos os jogos aprovados serao salvos automaticamente na tabela `lay0x1_analyses` (sem precisar clicar "Salvar" em cada um). O botao "Salvar" continua disponivel para jogos reprovados que o usuario queira acompanhar manualmente.

Arquivo: `src/components/Lay0x1/Lay0x1Scanner.tsx`
- Apos receber os resultados, chamar `saveAnalysis()` automaticamente para cada resultado com `approved === true`
- Evitar duplicatas: verificar se o `fixture_id` ja existe antes de salvar
- Exibir toast: "X jogos aprovados salvos automaticamente"

**2. Auto-resolucao buscando placar final da API-Football**

Criar um botao "Resolver Pendentes" no Dashboard que busca o placar final de todos os jogos pendentes via API-Football e resolve automaticamente.

Arquivo: `src/components/Lay0x1/Lay0x1Dashboard.tsx`
- Adicionar botao "Resolver Pendentes Automaticamente" na secao de pendentes
- Para cada jogo pendente, chamar a edge function `api-football` com endpoint `fixtures` e `id = fixture_id`
- Se o jogo ja terminou (status FT/AET/PEN), extrair o placar e chamar `resolveAnalysis()`
- Se o jogo ainda nao terminou, ignorar e manter como pendente
- Mostrar progresso: "Resolvendo X de Y..."

**3. Botao de resolucao em lote na Dashboard**

Alem do botao geral, manter a opcao manual individual para casos especificos.

### Detalhes Tecnicos

**Scanner - Auto-save (`Lay0x1Scanner.tsx`):**

```text
Apos analyzeGames():
1. Filtrar resultados aprovados
2. Buscar fixture_ids ja salvos no banco (via useLay0x1Analyses)
3. Para cada aprovado nao-duplicado, chamar saveAnalysis()
4. Toast com contagem
```

**Dashboard - Auto-resolve (`Lay0x1Dashboard.tsx`):**

```text
Funcao resolveAllPending():
1. Para cada analise pendente (sem result):
   a. Chamar supabase.functions.invoke('api-football', { endpoint: 'fixtures', params: { id: fixture_id } })
   b. Verificar status do jogo (FT, AET, PEN = terminado)
   c. Se terminado: extrair goals.home e goals.away
   d. Chamar resolveAnalysis(id, home, away)
   e. Se nao terminado: pular
2. Processar em lotes de 5 para nao sobrecarregar
3. Exibir progresso e resultado final
```

### Arquivos Modificados

- `src/components/Lay0x1/Lay0x1Scanner.tsx` -- auto-save dos aprovados
- `src/components/Lay0x1/Lay0x1Dashboard.tsx` -- botao "Resolver Pendentes" com busca automatica de placar

