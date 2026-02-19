

## Diagnostico: Matchbook API retornando 403 (Cloudflare)

### O que aconteceu

A Edge Function `matchbook-api` esta funcionando corretamente em termos de codigo. O problema e que a API da Matchbook esta protegida pelo **Cloudflare**, que bloqueia requisicoes vindas de IPs de datacenters/cloud (como os usados pelo Supabase Edge Functions).

Quando a funcao tenta fazer login, em vez de receber o JSON com o `session-token`, recebe uma pagina HTML de challenge do Cloudflare com status **403 Forbidden**.

### Causa raiz

O Cloudflare detecta que a requisicao vem de um IP de datacenter (nao de um navegador/usuario real) e bloqueia com um challenge. Isso e um comportamento padrao de protecao anti-bot que a Matchbook usa. Nao ha como contornar isso de forma confiavel a partir de uma Edge Function.

### Solucoes possiveis

**Opcao A: Usar a Matchbook a partir do navegador (CORS proxy)**
- A API da Matchbook aceita chamadas do navegador (CORS habilitado)
- O frontend faria as chamadas diretamente para `api.matchbook.com`
- O usuario digitaria username/password no frontend (nao ficam salvos no servidor)
- Vantagem: funciona sem bloqueio do Cloudflare
- Desvantagem: credenciais ficam no navegador (mas e o fluxo normal de uso da Matchbook)

**Opcao B: Proxy residencial externo**
- Usar um servico de proxy residencial para rotear as chamadas
- Custo adicional e complexidade
- Nao recomendado

**Opcao C: Contactar suporte da Matchbook**
- Pedir para liberarem o range de IPs do Supabase
- Processo demorado e sem garantia

### Recomendacao: Opcao A

Modificar a integracao para que o frontend chame a API da Matchbook diretamente do navegador do usuario, sem passar pela Edge Function.

### Alteracoes

**1. Remover `supabase/functions/matchbook-api/index.ts`**
- A Edge Function nao sera mais necessaria

**2. Modificar `src/hooks/useMatchbook.ts`**
- Fazer chamadas diretamente para `https://api.matchbook.com` do navegador
- Armazenar o session-token em memoria (useState) com TTL de 4h
- Adicionar campos de username/password no hook (vindos do formulario)
- Manter mesma interface publica: `login()`, `fetchEvents()`, `fetchCorrectScoreLay()`

**3. Modificar `src/pages/MatchbookOdds.tsx`**
- Adicionar campos de username e password no formulario de login
- Salvar credenciais em `sessionStorage` para nao pedir a cada visita (opcional, limpo ao fechar o navegador)
- Manter o mesmo layout e fluxo de uso

### Detalhes tecnicos

A Matchbook API suporta CORS para chamadas do navegador. O fluxo sera:

```text
Navegador do usuario
    |
    +-- POST https://api.matchbook.com/bpapi/rest/security/session
    |   (login direto, sem Edge Function)
    |
    +-- GET https://api.matchbook.com/edge/rest/events?category-ids=1
    |   (com header session-token)
    |
    +-- GET https://api.matchbook.com/edge/rest/events/{id}/markets
        (com header session-token)
```

O token sera armazenado em memoria e reutilizado por ate 4 horas. As credenciais opcionalmente ficam em `sessionStorage` (apagadas ao fechar o navegador).

