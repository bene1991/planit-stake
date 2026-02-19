

## Resumo Diario Telegram - Mensagem de Fechamento

### O que sera feito

Criar um segundo botao/modal no Planejamento para gerar uma mensagem de **resumo das operacoes do dia** (ou de uma data especifica) para os metodos Lay 0x1 e Lay 1x0, mostrando resultado em percentual de stakes (1 stake = 100%).

### Novo componente: `src/components/TelegramSummaryMessage.tsx`

Modal com a mensagem de resumo contendo:

- Para cada jogo com Lay 0x1 ou Lay 1x0 que tenha resultado (Green/Red):
  - Nome do jogo, liga, mercado
  - Resultado (Green/Red)
  - Lucro/prejuizo em % de stake (profit / stakeValue * 100)

- Totais:
  - Operacoes: X (Y Green, Z Red)
  - Win Rate: XX%
  - Resultado do dia: +/- XX% de stake

Formato da mensagem:

```text
📋 RESUMO DO DIA - dd/mm/aaaa

🏟 Time A x Time B
📍 Liga
🎯 Mercado: Lay 0x1
✅ Green | +95.5% de stake
(ou ❌ Red | -100% de stake)

🏟 Time C x Time D
📍 Liga
🎯 Mercado: Lay 1x0
❌ Red | -100% de stake

---

📊 Totalizador:
• Operacoes: 3 (2 Green, 1 Red)
• Win Rate: 66.7%
• Resultado: +91.0% de stake

Bons trades!
```

### Calculo do resultado em %

- Se a operacao tem `profit` e `stakeValue` definidos: `(profit / stakeValue) * 100`
- Se so tem `result` sem profit calculado: Green = mostrar "Green" sem %, Red = mostrar "Red" sem %
- 1 stake = 100%, entao um profit de 0.955 stake = +95.5%

### Alteracoes em `src/pages/DailyPlanning.tsx`

- Adicionar botao "Resumo" ao lado do botao "Telegram" existente (icone diferente, ex: FileText ou ClipboardList)
- O botao filtra jogos da data selecionada (por padrao ontem ou hoje) que tenham resultado para Lay 0x1/1x0
- Abre o modal com a mensagem pronta para copiar ou enviar

### Botoes de copiar e enviar

Mesma logica do componente de planejamento: copiar para clipboard e enviar via API do Telegram usando credenciais salvas.

### Detalhes tecnicos

- A prop `date` sera passada para o componente para permitir gerar resumo de qualquer data
- O componente recebe `games` (ja filtrados por data) e `methods`
- Calculo de profit em stakes: `profit / stakeValue * 100` quando ambos existem
- Nenhuma alteracao de banco de dados necessaria
