

## Corrigir conexao Matchbook - Proxy via Edge Function

### Problema

A chamada direta do navegador para `api.matchbook.com` falha com **"Failed to fetch"** (erro de CORS). A API da Matchbook nao permite requisicoes cross-origin do navegador.

A abordagem anterior de Edge Function foi removida porque o Cloudflare bloqueava com 403. Porem, a solucao e criar uma Edge Function proxy com headers adequados (User-Agent de navegador real) para evitar a deteccao do Cloudflare.

### Solucao

Criar uma Edge Function `matchbook-proxy` que atua como proxy generico para qualquer chamada a API da Matchbook. O frontend envia o path e os headers necessarios, e a Edge Function faz a requisicao real.

### Alteracoes

**1. Nova Edge Function: `supabase/functions/matchbook-proxy/index.ts`**
- Recebe requisicoes POST com `{ url, method, headers, body }`
- Faz a requisicao para a Matchbook API com User-Agent de navegador real
- Retorna a resposta (status, headers, body) ao frontend
- Adiciona headers CORS para o frontend
- User-Agent realista para evitar bloqueio Cloudflare

**2. Atualizar `supabase/config.toml`**
- Adicionar entrada `[functions.matchbook-proxy]` com `verify_jwt = false`

**3. Atualizar `src/hooks/useMatchbookMonitor.ts`**
- Substituir chamadas diretas a `api.matchbook.com` por chamadas ao proxy Edge Function
- O proxy sera chamado via `supabase.functions.invoke('matchbook-proxy', ...)`
- Manter toda a logica de cache, flash de odds, e auto-refresh

**4. Atualizar `src/hooks/useMatchbook.ts`**
- Mesma mudanca: rotear todas as chamadas via proxy
- Manter logica de token, TTL, e re-autenticacao

**5. Atualizar `src/hooks/useMatchbookEventLinker.ts`**
- Rotear chamadas de busca de eventos via proxy

### Detalhes tecnicos

**Edge Function proxy (matchbook-proxy):**
```text
POST /matchbook-proxy
Body: {
  "url": "https://api.matchbook.com/bpapi/rest/security/session",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"username\":\"...\",\"password\":\"...\"}"
}

Resposta: {
  "status": 200,
  "data": { "session-token": "abc123..." }
}
```

A Edge Function adicionara headers como:
- `User-Agent`: string de navegador Chrome real
- `Accept`: conforme recebido
- `Referer`: `https://www.matchbook.com/`

Isso deve contornar tanto o CORS (frontend -> Edge Function) quanto o Cloudflare (Edge Function -> Matchbook com headers de navegador).

