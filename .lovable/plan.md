

## Otimizacoes do Scanner Lay 0x1

### Problemas Identificados

1. **Jogos somem ao sair da pagina**: O estado e mantido em `useState` local, que reseta ao desmontar o componente
2. **Muito lento**: O scanner envia TODOS os jogos do dia para analise (potencialmente 200+ jogos), cada um gerando 4 chamadas de API
3. **Falta criterio**: Odd da casa deve ser menor que odd do visitante (fundamental para Lay 0x1)

---

### Solucao 1 - Auto-fetch e persistencia

**Arquivo: `src/components/Lay0x1/Lay0x1Scanner.tsx`**

- Adicionar `useEffect` que busca fixtures automaticamente ao montar o componente (quando `selectedDate` muda)
- Guardar fixtures e results em `sessionStorage` com chave por data, para que ao voltar a pagina os dados ja estejam la
- Ao montar, verificar se ja existe cache em sessionStorage para a data atual antes de buscar

### Solucao 2 - Performance (pre-filtragem de odds)

**Arquivo: `supabase/functions/analyze-lay0x1/index.ts`**

Atualmente o fluxo e:
1. Frontend busca TODOS os fixtures do dia (1 chamada API)
2. Envia TODOS os IDs para a edge function
3. Edge function faz 4 chamadas por jogo (fixture, h2h, stats home, stats away + odds)

**Otimizacao**: Mover a busca de fixtures para dentro da edge function e fazer pre-filtragem por odds ANTES de analisar cada jogo em detalhe:

1. Edge function recebe apenas a `date` (em vez de fixture_ids)
2. Busca fixtures do dia (1 chamada)
3. Busca odds de TODOS os jogos em lote (endpoint `odds` aceita `date`)
4. Filtra apenas jogos onde `home_odd < away_odd` (criterio novo)
5. So ENTAO analisa os jogos filtrados (H2H, stats)
6. Isso reduz drasticamente o numero de chamadas - de ~800 (200 jogos x 4) para ~50-80 (pre-filtrados)

O frontend passa a fazer uma unica chamada com a data, sem precisar buscar fixtures separadamente.

### Solucao 3 - Novo criterio: Odd casa < Odd visitante

**Arquivo: `supabase/functions/analyze-lay0x1/index.ts`**

- Extrair `home_odd` alem de `away_odd` na fase de odds
- Adicionar criterio `home_odd_lower`: `home_odd < away_odd`
- Incluir no criteria_met e nas reasons quando falhar
- Incluir `home_odd` no objeto criteria retornado

**Arquivo: `src/components/Lay0x1/Lay0x1Scanner.tsx`**

- Nao precisa mais do botao "Buscar Jogos" separado - um unico botao "Analisar" busca e analisa
- Mostrar progresso durante a analise

---

### Detalhes Tecnicos

**Mudancas em `analyze-lay0x1/index.ts`:**
- Aceitar `{ date }` alem de `{ fixture_ids }` como input
- Quando receber `date`: buscar fixtures, buscar odds em lote, pre-filtrar, analisar apenas os filtrados
- Extrair home_odd do mesmo endpoint de odds
- Novo criterio: `home_odd_lower: homeOdd > 0 && homeOdd < awayOdd`
- Reason: `"Odd casa (X.XX) >= Odd visitante (X.XX)"`

**Mudancas em `Lay0x1Scanner.tsx`:**
- Remover estado `fixtures` separado e botao "Buscar Jogos"
- Um unico botao "Analisar Jogos do Dia" que envia `{ date: selectedDate }` para a edge function
- `useEffect` no mount: se ja tem resultados em sessionStorage para a data, carrega; senao, dispara analise automaticamente
- Salvar `results` em `sessionStorage` com chave `lay0x1_results_${selectedDate}`
- Ao mudar data, limpar resultados e buscar novamente
- Mostrar contador de progresso durante analise

**Arquivos modificados:**
- `supabase/functions/analyze-lay0x1/index.ts` (pre-filtragem por odds + novo criterio)
- `src/components/Lay0x1/Lay0x1Scanner.tsx` (auto-fetch + cache + UI simplificada)

