

## Bug: Jogos adicionados não aparecem no planejamento

### Causa raiz

Voce tem **1012 jogos** no banco de dados. O sistema tem um limite padrao de **1000 registros por consulta**. Como os jogos mais recentes ultrapassam esse limite, eles simplesmente nao aparecem na interface -- mesmo que tenham sido salvos corretamente no banco.

Os jogos ESTAO no banco de dados (confirmei). O problema e que a consulta que carrega os jogos so traz os primeiros 1000.

### Solucao

Corrigir a consulta de jogos para buscar TODOS os registros, sem limite de 1000.

---

### Detalhes tecnicos

**Arquivo: `src/hooks/useSupabaseGames.ts`**

A funcao `fetchGamesWithOperations` faz:
```typescript
supabase.from('games').select('*').eq('owner_id', userId)
```

Isso retorna no maximo 1000 registros (limite padrao). Preciso paginar ou aumentar o limite para trazer todos os jogos.

**Correcao:** Implementar paginacao automatica na consulta, buscando em lotes de 1000 ate trazer todos os registros. Tambem aplicar o mesmo para `method_operations` que pode ter o mesmo problema.

```typescript
// Buscar todos os jogos com paginacao automatica
const fetchAllRows = async (query) => {
  let allData = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    allData = [...allData, ...(data || [])];
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  
  return allData;
};
```

Isso garante que mesmo com milhares de jogos, todos serao carregados corretamente.

