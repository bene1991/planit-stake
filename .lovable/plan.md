

## Corrigir Redirecionamento Geografico da Matchbook API

### Problema Real

A Edge Function `matchbook-proxy` roda em um servidor cujo IP e detectado como Brasil pela Matchbook. A API redireciona (HTTP 301/302) para `matchbook.bet.br`, que retorna uma pagina HTML do site brasileiro. O `redirect: 'follow'` segue esse redirect automaticamente, resultando em HTML em vez de JSON.

Evidencia: o response body contem `<html lang="pt-br">` e `<title>Apostas esportivas online...Matchbook</title>` do dominio `matchbook.bet.br`.

### Solucao

**1. Atualizar `supabase/functions/matchbook-proxy/index.ts`**

- Trocar `redirect: 'follow'` por `redirect: 'manual'` para impedir que o fetch siga redirects geograficos
- Adicionar header `Accept-Language: en-GB,en;q=0.9` para sinalizar que queremos a versao internacional
- Quando receber um response 3xx (redirect), retornar erro descritivo com a URL de destino em vez de seguir
- Adicionar logs para debug: URL sendo chamada, status recebido, primeiros 200 caracteres do body
- Se o response for HTML (comeca com `<!` ou `<html`), retornar erro especifico informando o redirecionamento

**2. Atualizar `src/hooks/useMatchbookMonitor.ts`**

- Melhorar a mensagem de erro quando detectar HTML para mostrar "Servidor bloqueado por geo-restricao" em vez da mensagem generica atual

### Detalhes Tecnicos

Mudanca principal no proxy:

```text
// ANTES
redirect: 'follow'    // segue o redirect para matchbook.bet.br

// DEPOIS  
redirect: 'manual'    // NAO segue redirects
+ Accept-Language: en-GB,en;q=0.9
+ Verificacao: se status 3xx, retorna erro com Location header
+ Verificacao: se body comeca com HTML, retorna erro especifico
```

Se mesmo com essas mudancas o servidor da Matchbook ainda retornar HTML (o que significaria que o bloqueio e por IP direto, nao por redirect), a alternativa seria usar as credenciais salvas nos secrets do backend (`MATCHBOOK_USERNAME` e `MATCHBOOK_PASSWORD`) para fazer o login diretamente no servidor, sem depender do frontend enviar credenciais.

