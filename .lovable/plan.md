

## Botao "Planejamento Diario Telegram"

### O que sera feito

Um botao novo na area de header do Planejamento que, ao clicar, gera a mensagem formatada com todos os jogos do dia que possuem metodo "Lay 0x1" ou "Lay 1x0" e abre um modal com a mensagem pronta para copiar ou enviar direto ao Telegram.

### Componentes

**1. Novo componente `src/components/TelegramPlanningMessage.tsx`**
- Modal (Dialog) com a mensagem gerada
- Botao "Copiar" que copia o texto para a area de transferencia
- Botao "Enviar ao Telegram" que envia via API do Telegram usando as credenciais salvas nas configuracoes do usuario
- A mensagem segue exatamente o formato solicitado

**2. Atualizar `src/pages/DailyPlanning.tsx`**
- Adicionar botao com icone Send (Telegram) na barra de acoes do header, ao lado dos botoes existentes
- Ao clicar, filtra os jogos do dia atual cujos metodos contenham "Lay 0x1" ou "Lay 1x0" (busca pelo nome do metodo)
- Busca a odd de entrada (`entryOdds`) de cada operacao para incluir na mensagem
- Abre o modal com a mensagem pronta

### Logica de filtragem

```text
1. Pegar todos os jogos com date = hoje (Brasilia)
2. Para cada jogo, verificar se algum methodOperation tem methodId 
   cujo nome no bankroll.methods seja "Lay 0x1" ou "Lay 1x0"
3. Montar a mensagem com os dados de cada jogo + metodo
4. Se a odd de entrada (entryOdds) estiver preenchida, usar ela
   Se nao, exibir "A definir"
```

### Formato da mensagem gerada

```text
PLANEJAMENTO DO DIA

Jogo: Time A x Time B
Liga: Liga
Mercado: Lay 0x1
Odd minima para entrada: 1.50
Entrada somente com jogo em 0x0
Responsabilidade: consultar planilha de alavancagem

---

Regras da operacao:
- Operar apenas um placar por jogo
- Nao entrar fora da odd definida

Gestao de banca (orientacao):
- Iniciar ciclo com no maximo 1% da banca
- Seguir progressao da planilha sem improvisar
- Ao atingir 100%, resetar para a responsabilidade inicial
- Nunca ultrapassar o risco pre-definido
```

(com emojis conforme especificado)

### Envio ao Telegram

Usa as credenciais ja salvas na tabela `settings` (telegram_bot_token e telegram_chat_id) para enviar a mensagem diretamente, reutilizando o padrao do `sendTelegramNotification` existente.

### Detalhes tecnicos

- O botao so aparece se existirem jogos do dia com metodos Lay 0x1/1x0
- Modal usa Dialog do Radix (ja instalado)
- Textarea readonly com a mensagem para facil copia
- Toast de sucesso/erro apos copiar ou enviar
- Nenhuma alteracao de banco de dados necessaria

