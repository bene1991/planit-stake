

## Corrigir Proxy Matchbook - API retornando HTML

### Problema Identificado

A Edge Function `matchbook-proxy` esta adicionando headers `Referer: https://www.matchbook.com/` e `Origin: https://www.matchbook.com` na requisicao para a API. Isso faz com que a API da Matchbook detecte a origem e redirecione para o site brasileiro (`matchbook.bet.br`), retornando uma pagina HTML completa em vez do JSON esperado.

A resposta do proxy mostra claramente HTML com `<title>Apostas esportivas online - Matchbook</title>` em vez de `{"session-token": "..."}`.

### Solucao

**1. Atualizar `supabase/functions/matchbook-proxy/index.ts`**
- Remover os headers `Referer` e `Origin` que causam o redirecionamento geografico
- Alterar `Accept` para `*/*` conforme a documentacao oficial da Matchbook
- Adicionar `redirect: 'follow'` ao fetch para garantir que redirects sejam seguidos corretamente
- Adicionar log do response status e primeiros caracteres para debug

**2. Atualizar `src/hooks/useMatchbookMonitor.ts`**
- Melhorar o `matchbookFetch` para detectar quando a resposta e HTML (nao JSON) e lancar erro descritivo
- Isso evita o erro silencioso "Sem session-token" e mostra algo como "API retornou HTML em vez de JSON"

**3. Atualizar `src/hooks/useMatchbook.ts`**
- Mesma melhoria de deteccao de HTML no response

### Detalhes Tecnicos

Headers atuais (incorretos):
```text
User-Agent: Chrome/125...
Accept: application/json
Referer: https://www.matchbook.com/    <-- CAUSA REDIRECT
Origin: https://www.matchbook.com      <-- CAUSA REDIRECT
```

Headers corrigidos (conforme documentacao oficial):
```text
User-Agent: Chrome/125...
Accept: */*
(sem Referer, sem Origin)
```

A documentacao oficial da Matchbook API mostra o login assim:
```text
POST https://api.matchbook.com/bpapi/rest/security/session
Content-Type: application/json;charset=UTF-8
Accept: */*
Body: {"username":"...","password":"..."}
```

