
## Adicionar Resultado Acumulado do Mes no Resumo Telegram

### O que sera feito

Adicionar um botao/checkbox no modal de Resumo do Dia que permite incluir o resultado acumulado do mes (do dia 1 ate a data selecionada) na mensagem. Quando ativado, a mensagem tera uma secao extra apos o totalizador diario mostrando:

- Total de operacoes no mes
- Greens e Reds acumulados
- Win Rate mensal
- Resultado acumulado em % de stake

### Como vai funcionar

1. **Novo toggle** no modal: um Switch/Checkbox com label "Incluir acumulado do mes"
2. **Logica de calculo**: filtrar todos os jogos do mes (mesmo ano-mes da data selecionada), calcular os totais usando a mesma logica de `buildSummaryItems`
3. **Secao extra na mensagem** quando ativado:

```
---

📅 ACUMULADO DO MES (01/02 a 19/02):
• Operacoes: 45 (32 Green, 13 Red)
• Win Rate: 71.1%
• Resultado: +125.3% de stake

Bons trades!
```

### Detalhes tecnicos

**Arquivo: `src/components/TelegramSummaryMessage.tsx`**

- Adicionar estado `includeMonthly` (boolean, default false)
- Criar funcao `buildMonthlyAccumulated` que:
  - Extrai o ano-mes da data selecionada (`selectedDateStr.slice(0, 7)`)
  - Filtra todos os jogos com `g.date.startsWith(yearMonth)` e `g.date <= selectedDateStr`
  - Usa `buildSummaryItems` para calcular os items de todos esses dias
  - Retorna totais: operacoes, greens, reds, winRate, stakePercent
- Modificar `buildSummaryMessage` para aceitar dados mensais opcionais e anexar a secao extra
- Adicionar um Switch/Checkbox na UI entre o date picker e o textarea
