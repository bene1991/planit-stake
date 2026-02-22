
## Suprimir Notificacoes Telegram para Jogos Finalizados

### Problema
Quando voce marca um jogo como Green, Red ou Void, o monitor em background continua enviando notificacoes de gol e cartao vermelho no Telegram. Isso gera alertas desnecessarios para jogos que voce ja finalizou.

### Solucao
Antes de enviar qualquer notificacao Telegram (gol ou cartao), o monitor vai verificar se o jogo ja tem algum resultado definido (Green, Red ou Void) nas operacoes de metodo. Se ja tiver, pula as notificacoes mas continua atualizando o placar no banco.

### O que muda na pratica
- Marcou Green/Red/Void em um jogo → para de receber alertas no Telegram
- O placar continua sendo atualizado normalmente no banco de dados
- Apenas as notificacoes sao suprimidas, nao o monitoramento

---

### Detalhes tecnicos

**Arquivo:** `supabase/functions/monitor-live-games/index.ts`

Apos carregar os jogos ativos, o monitor vai buscar as operacoes de metodo (`method_operations`) para todos esses jogos. Se um jogo tiver **pelo menos uma operacao com resultado** (Green, Red ou Void), ele sera marcado como "finalizado pelo usuario" e as notificacoes Telegram serao suprimidas.

Logica adicionada no loop de processamento:
1. Buscar `method_operations` com `result IS NOT NULL` para todos os `game_ids` ativos (1 query batch)
2. Criar um Set de `game_id`s finalizados
3. Antes de enviar notificacao de gol ou cartao, verificar se `game.id` esta no Set
4. Se estiver, logar `[Monitor] Skipping notification - game already finalized` e pular o envio

O placar e o estado do monitor continuam sendo atualizados normalmente, apenas o envio Telegram e suprimido.
