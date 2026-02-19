

## Integracao Matchbook - Correct Score LAY

### Visao Geral

Criar uma integracao completa com a API da Matchbook Exchange para buscar odds de Correct Score (LAY), incluindo backend (Edge Function) e frontend (pagina dedicada).

### Seguranca

As credenciais da Matchbook (username e password) serao armazenadas como secrets seguros no backend, nunca expostos no frontend. O usuario nao precisara digitar as credenciais na interface -- a autenticacao sera automatica via backend.

### Arquitetura

```text
Frontend (MatchbookDashboard)
    |
    v
Edge Function (matchbook-api)
    |
    +-- POST /login  --> Matchbook Session API
    +-- GET /events  --> Matchbook Events API
    +-- GET /correct-score-lay --> Matchbook Markets API
```

### Alteracoes

**1. Secrets (2 novos)**
- `MATCHBOOK_USERNAME` - username da conta Matchbook
- `MATCHBOOK_PASSWORD` - password da conta Matchbook

**2. Edge Function: `supabase/functions/matchbook-api/index.ts`**

Funcao unica com 3 acoes:

- **login**: POST para `https://api.matchbook.com/bpapi/rest/security/session` com as credenciais dos secrets. Retorna o session-token. Armazena em variavel de modulo para reutilizacao (com TTL de 4h para auto-renovacao).

- **events**: GET para `https://api.matchbook.com/edge/rest/events?category-ids=1` (futebol) usando o session-token. Retorna lista simplificada com `event_id`, `event_name`, `start_time`.

- **correct-score-lay**: GET para `https://api.matchbook.com/edge/rest/events/{event_id}/markets`, filtra por mercado "Correct Score", depois busca os runners com preco LAY. Retorna array de `{ score, lay_price, lay_available }`.

Tratamento de erros:
- 401: auto-renovacao do token e retry
- 400/500: mensagem de erro clara
- CORS headers padrao

**3. Config: `supabase/config.toml`**
- Adicionar `[functions.matchbook-api]` com `verify_jwt = false`

**4. Hook: `src/hooks/useMatchbook.ts`**
- Hook React para gerenciar estado da conexao, lista de eventos e odds de Correct Score
- Funcoes: `login()`, `fetchEvents()`, `fetchCorrectScoreLay(eventId)`
- Gerenciamento de loading/error states

**5. Pagina: `src/pages/MatchbookOdds.tsx`**
- Dashboard com tema escuro focado em trading
- Botao "Conectar" que dispara login automatico (credenciais ja nos secrets)
- Status de conexao (conectado/desconectado)
- Lista de eventos de futebol com busca/filtro
- Ao clicar em evento: tabela responsiva com Score | Lay Price | Lay Available
- Botao refresh para atualizar odds manualmente
- Indicador de ultima atualizacao

**6. Rota: `src/App.tsx`**
- Adicionar rota `/matchbook` protegida com Layout

**7. Navegacao: nao sera adicionada ao menu principal**
- A pagina sera acessivel via URL direta `/matchbook` para manter o menu limpo
- Pode ser adicionada ao menu posteriormente se desejado

### Detalhes tecnicos da Edge Function

```text
// Variavel de modulo para cache do session-token
let sessionToken: string | null = null;
let tokenTimestamp: number = 0;
const TOKEN_TTL = 4 * 60 * 60 * 1000; // 4 horas

// Auto-login: se token expirado ou inexistente, faz login automatico
// Retry: se qualquer chamada retorna 401, invalida token e tenta novamente
```

### Estrutura da resposta de Correct Score LAY

```text
[
  { score: "0-0", lay_price: 8.5, lay_available: 150.00 },
  { score: "1-0", lay_price: 6.2, lay_available: 200.00 },
  { score: "1-1", lay_price: 5.8, lay_available: 180.00 },
  ...
]
```

