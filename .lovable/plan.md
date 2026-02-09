
## Ordenar Metodos na Sequencia Desejada

### Problema

Os metodos aparecem na ordem que o banco de dados retorna (sem garantia de sequencia). O usuario quer que aparecam sempre na ordem que ele definiu (1, 2, 3, 4...).

### Solucao

Adicionar uma coluna `sort_order` na tabela `methods` e ordenar por ela ao carregar.

### Etapas

**1. Migracao no banco de dados**

Adicionar coluna `sort_order` (integer, default 0) na tabela `methods`. Atualizar os registros existentes com uma ordem baseada na data de criacao para manter consistencia.

```text
ALTER TABLE methods ADD COLUMN sort_order integer DEFAULT 0;

-- Atribuir ordem inicial baseada na data de criacao
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at) as rn
  FROM methods
)
UPDATE methods SET sort_order = ordered.rn FROM ordered WHERE methods.id = ordered.id;
```

**2. Modificar `src/hooks/useSupabaseBankroll.ts`**

- No `loadMethods`: adicionar `.order('sort_order', { ascending: true })` na query e incluir `sort_order` no mapeamento
- No `addMethod`: calcular o proximo `sort_order` (max atual + 1) ao inserir
- Adicionar funcao `reorderMethods(methodIds: string[])` que recebe a lista de IDs na nova ordem e atualiza o `sort_order` de cada um no banco

**3. Modificar `src/pages/BankrollManagement.tsx`**

- Adicionar botoes de seta (cima/baixo) em cada metodo para mover na lista
- Ao clicar, trocar o `sort_order` entre os dois metodos adjacentes e salvar no banco
- Usar icones `ChevronUp` e `ChevronDown` do lucide-react ao lado dos botoes de editar/deletar

### Resultado

Os metodos sempre aparecerao na ordem definida pelo usuario, e ele podera reorganizar a qualquer momento usando as setas.
