

## Persistir credenciais Matchbook

### Problema
As credenciais (username/password) desaparecem ao recarregar a pagina por dois motivos:
1. Sao armazenadas em `sessionStorage`, que se perde ao fechar a aba
2. So sao salvas apos conexao bem-sucedida (linha 147-151 de MonitorTrader.tsx) -- se o login falha, nunca sao gravadas

### Solucao
Trocar `sessionStorage` por `localStorage` e salvar as credenciais imediatamente ao clicar "Conectar", independente do resultado da conexao.

### Alteracoes

**1. `src/hooks/useMatchbookMonitor.ts`**
- Linha 32-38: Trocar `sessionStorage` por `localStorage` nas funcoes `loadCreds` e `saveCreds` (implicitamente chamadas no hook)

**2. `src/pages/MonitorTrader.tsx`**
- Linhas 20-25: Trocar `sessionStorage.getItem`/`setItem`/`removeItem` por `localStorage`
- Linha 153-156 (`handleConnect`): Salvar credenciais **antes** de chamar `monitor.login()`, para que persistam mesmo se o login falhar
- Remover o `useEffect` de salvar creds apos conexao (linhas 147-151), ja que agora salvamos no clique

Resultado: ao recarregar a pagina, o username e password ja estarao preenchidos e o auto-login tentara reconectar automaticamente.

