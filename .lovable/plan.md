
## Corrigir erro "group chat was upgraded to a supergroup chat" no Telegram

### O Problema

Quando um grupo do Telegram e convertido em **supergrupo** (o que acontece automaticamente quando o grupo passa de certo tamanho ou quando alguma funcionalidade de supergrupo e ativada), o `chat_id` muda. O antigo ID negativo (ex: `-5223159610`) se torna um novo ID prefixado com `-100` (ex: `-1005223159610`).

A API do Telegram retorna o novo ID no campo `parameters.migrate_to_chat_id` da resposta de erro. Atualmente o codigo ignora esse campo e apenas exibe o erro bruto para o usuario.

### A Solucao

Nos dois componentes (`TelegramPlanningMessage.tsx` e `TelegramSummaryMessage.tsx`), dentro da funcao `handleSendTelegram`, detectar especificamente esse erro e:

1. Extrair o novo `chat_id` de `data.parameters?.migrate_to_chat_id`
2. Atualizar automaticamente o `telegram_chat_id` nas configuracoes do usuario via `updateSettings`
3. Reenviar a mensagem automaticamente com o novo `chat_id`
4. Exibir um toast informativo ao usuario dizendo que o ID foi atualizado automaticamente

### Arquivos Modificados

**1. `src/components/TelegramPlanningMessage.tsx`**
- Adicionar `updateSettings` ao `useSettings()`
- Substituir `toast.error('Erro do Telegram: ...')` por logica que detecta `migrate_to_chat_id`

**2. `src/components/TelegramSummaryMessage.tsx`**
- Mesma logica aplicada ao `handleSendTelegram` do resumo

### Logica do Fix

```typescript
if (!data.ok) {
  const newChatId = data.parameters?.migrate_to_chat_id;
  if (newChatId) {
    // Grupo foi convertido em supergrupo - atualizar ID automaticamente
    await updateSettings({ telegram_chat_id: String(newChatId) });
    // Reenviar com o novo ID
    const retry = await fetch(`https://api.telegram.org/bot.../sendMessage`, {
      body: JSON.stringify({ chat_id: newChatId, text: message })
    });
    const retryData = await retry.json();
    if (retryData.ok) {
      toast.success('✅ Mensagem enviada! Chat ID atualizado automaticamente.');
    }
  } else {
    toast.error('Erro do Telegram: ' + data.description);
  }
}
```

### Resultado

O usuario nao precisara fazer nada manualmente. Na proxima vez que tentar enviar, o ID ja estara correto nas configuracoes e o envio funcionara normalmente.
