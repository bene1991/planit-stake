
## Entendimento do que está acontecendo

Pelo seu relato (“de novo apagou as buscas”) e pelo estado atual do scanner, o problema está no **estado/caching local do Lay 0x1**. Hoje ele depende de cache no navegador e há alguns pontos frágeis que podem fazer parecer que “sumiu tudo” ao sair e voltar.

## Causas prováveis encontradas no código

1. **Restauração do cache ignora buscas com lista vazia**  
   No load inicial, o scanner só restaura se `cached.length > 0`.  
   Se a busca existiu mas retornou 0 jogos, o app trata como “não existe cache”, limpando também o meta (resumo do dia).

2. **Persistência manual usa chave de data inconsistente**  
   Ao “Adicionar manualmente”, o cache é salvo com `result.date` (data do fixture), não necessariamente a data selecionada no scanner (`selectedDate`).  
   Isso pode salvar na chave errada e, ao voltar para a tela, parecer que a busca atual desapareceu.

3. **Modo range/backtest pode corromper cache por dia**  
   Em contexto agregado (7d/15d/30d/90d), ao salvar manualmente, o estado atualizado pode incluir jogos de múltiplos dias e ser persistido em uma única chave de data.

4. **Falha silenciosa de localStorage**  
   Se o armazenamento encher, o `setCachedResults` falha em silêncio (`catch` vazio), e a busca não é persistida — ao reabrir, parece “apagada”.

5. **Contexto da última busca não é lembrado**  
   Ao remontar a página, sempre volta para “Hoje”, mesmo que a última análise tenha sido em outra data/período.

---

## Plano de correção

### 1) Corrigir a restauração de cache (inclusive quando resultado = 0)
**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Trocar a lógica de restore para considerar cache válido quando `cached !== null` (não depender de `length > 0`).
- Restaurar `meta` mesmo com lista vazia.
- Isso evita “sumiço” visual de buscas que retornaram poucos/nenhum jogo.

### 2) Corrigir chave de persistência ao adicionar manualmente
**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- No `handleSave`, salvar cache com a chave correta do contexto:
  - **single-day:** usar `selectedDate`.
  - **range/backtest:** atualizar apenas o cache do dia do card, sem gravar o array agregado inteiro em uma única chave.
- Manter sincronização UI imediata (`setResults`) + persistência correta por data.

### 3) Persistir e restaurar “último contexto de busca”
**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Criar chave leve de contexto (ex.: `lay0x1_last_context`) contendo:
  - `selectedDate`
  - `rangeMode` (quando aplicável)
  - timestamp
- Ao abrir scanner, restaurar esse contexto antes de carregar resultados.
- Isso reduz percepção de “sumiu” quando, na prática, o usuário só voltou para outra data padrão.

### 4) Tornar cache resiliente a limite de armazenamento
**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Implementar escrita “safe”:
  - tentar salvar
  - se falhar por quota, remover caches mais antigos do próprio Lay0x1 (LRU simples por timestamp)
  - tentar novamente
- Exibir feedback amigável (toast) quando houver limpeza automática de cache antigo.

### 5) Melhor feedback quando não houver cache disponível
**Arquivo:** `src/components/Lay0x1/Lay0x1Scanner.tsx`

- Mostrar estado vazio explícito:  
  “Nenhuma busca salva para esta data/período” + botão “Analisar novamente”.
- Evita interpretação de erro quando na verdade não há dados em cache.

---

## Sequência de implementação

1. Ajustar restore (`cached !== null`) e meta.
2. Corrigir `handleSave` para persistência por chave correta.
3. Adicionar persistência/restauração do último contexto.
4. Implementar cache-safe com poda automática.
5. Melhorar empty state e mensagens de feedback.
6. Validar cenários E2E.

---

## Validação (teste ponta a ponta)

1. Rodar scanner em **Hoje**, sair da página e voltar: resultados devem permanecer.
2. Repetir com **Ontem** e com **7d/15d**.
3. Adicionar jogo manualmente em reprovados, sair e voltar: deve continuar aprovado.
4. Simular dia com 0 resultados: ao voltar, deve manter resumo/meta e não parecer “apagado”.
5. Validar botão “Enviar p/ Planejamento” continua funcionando sem regressão.

---

## Critérios de aceite

- As buscas não “somem” ao navegar entre páginas.
- A aprovação manual permanece após recarregar/navegar.
- O scanner restaura corretamente data/período usado por último.
- Em falta de cache, a UI explica claramente e oferece reanálise.
- Sem regressão no dashboard/histórico/planejamento.
