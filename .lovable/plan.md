
## Plano: Corrigir Redirecionamento Indesejado ao Navegar Entre Páginas

### Problema Identificado

No arquivo `src/contexts/AuthContext.tsx`, linha 30-32:

```typescript
if (event === 'SIGNED_IN') {
  navigate('/');
}
```

O problema é que o Supabase dispara o evento `SIGNED_IN` em várias situações:
1. Quando o usuário faz login (comportamento desejado)
2. Quando o token é renovado automaticamente (indesejado)
3. Quando você troca de aba e o Supabase revalida a sessão (indesejado)

Isso causa o redirecionamento para `/` toda vez que qualquer uma dessas situações ocorre, mesmo que você esteja em `/performance`.

### Solução

Adicionar uma verificação para só redirecionar quando realmente for um novo login, não uma revalidação de sessão existente.

### Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `src/contexts/AuthContext.tsx` | Adicionar lógica para distinguir login real de revalidação |

### Detalhes Técnicos

#### Opção Implementada: Usar ref para rastrear primeiro carregamento

```typescript
// ANTES (problema)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN') {
        navigate('/');  // Isso roda SEMPRE que SIGNED_IN dispara
      }
    }
  );
  // ...
}, [navigate]);

// DEPOIS (corrigido)
const hasInitialized = useRef(false);

useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Só redireciona em login real, não em revalidação de sessão
      if (event === 'SIGNED_IN' && hasInitialized.current) {
        navigate('/');
      }
    }
  );

  // Verificar sessão existente
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
    hasInitialized.current = true;  // Marca como inicializado APÓS carregar sessão
  });

  return () => subscription.unsubscribe();
}, [navigate]);
```

### Lógica

1. `hasInitialized` começa como `false`
2. Quando o app carrega, verifica a sessão existente via `getSession()`
3. Durante esse carregamento, se `SIGNED_IN` disparar (revalidação), `hasInitialized` ainda é `false`, então não redireciona
4. Após carregar a sessão, `hasInitialized` vira `true`
5. A partir daí, se `SIGNED_IN` disparar, é um login real (usuário acabou de fazer login) e aí sim redireciona

### Resultado Esperado

- **Login real**: Usuário é redirecionado para `/` (comportamento desejado)
- **Revalidação de token**: Usuário permanece na página atual
- **Troca de aba**: Usuário permanece na página atual

### Benefícios

1. **Navegação estável**: Usuário não é mais redirecionado inesperadamente
2. **UX melhorada**: Pode alternar entre páginas sem perder contexto
3. **Login funciona**: O redirecionamento após login real ainda funciona
