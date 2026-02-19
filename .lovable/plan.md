

## Atualizar mensagem do Telegram

### Alteracoes no `src/components/TelegramPlanningMessage.tsx`

**1. Adicionar horario do jogo na mensagem**

Na interface `TelegramGame`, adicionar o campo `time: string`.

Na funcao `buildTelegramGames`, incluir `game.time` ao montar cada item.

Na funcao `buildMessage`, adicionar uma linha apos o jogo:
```
⏰ Horário: {horario}
```

**2. Adicionar regras de gestao de banca**

Acrescentar duas linhas novas na secao "Gestao de banca (orientacao)":
```
• Só aumentar a stake inicial após atingir pelo menos 500% de resultado acumulado
• Ao aumentar, nunca elevar mais do que 30% da stake atual
```

### Resultado final da mensagem

```text
📊 PLANEJAMENTO DO DIA

🏟 Jogo: Time A x Time B
📍 Liga: Liga
⏰ Horário: 16:00
🎯 Mercado: Lay 0x1
💰 Odd mínima para entrada: 1.50
⏱ Entrada somente com jogo em 0x0
📈 Responsabilidade: consultar planilha de alavancagem

---

⚙️ Regras da operação:
• Operar apenas um placar por jogo
• Não entrar fora da odd definida

💸 Gestão de banca (orientação):
• Iniciar ciclo com no máximo 1% da banca
• Seguir progressão da planilha sem improvisar
• Ao atingir 100%, resetar para a responsabilidade inicial
• Nunca ultrapassar o risco pré-definido
• Só aumentar a stake inicial após atingir pelo menos 500% de resultado acumulado
• Ao aumentar, nunca elevar mais do que 30% da stake atual
```

### Arquivo alterado
- `src/components/TelegramPlanningMessage.tsx` - adicionar campo `time` na interface e na funcao de build, incluir linha de horario na mensagem, e acrescentar as duas regras de gestao de banca.

