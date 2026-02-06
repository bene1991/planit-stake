

## Tooltips nos Selos de Validacao

### O que muda

Adicionar tooltips (hover) em cada um dos 3 selos de validacao (Robustez, Estabilidade, Variancia) nos cards da Analise de Metodo, explicando o que cada classificacao significa.

### Arquivo a editar

**`src/components/MethodAnalysis/MethodAnalysisCard.tsx`**

- Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` de `@/components/ui/tooltip`
- Adicionar prop `tooltip` ao componente `ValidationBadge`
- Envolver cada badge com `Tooltip` + `TooltipTrigger` + `TooltipContent`
- Envolver o bloco dos 3 badges com `TooltipProvider`

### Textos dos tooltips

| Selo | Tooltip |
|------|---------|
| Robusto | "O metodo funciona bem em diferentes ligas e faixas de odds, sem depender de cenarios especificos." |
| Sensivel | "O desempenho varia conforme o contexto (liga, odds). Funciona melhor em cenarios especificos." |
| Fragil | "O metodo depende fortemente de condicoes especificas. Fora do cenario ideal, o desempenho cai muito." |
| Estavel | "O desempenho recente e consistente com o historico. O metodo mantem sua performance ao longo do tempo." |
| Oscilante | "Ha variacao entre o desempenho recente e o historico. Requer acompanhamento." |
| Deterioracao | "O desempenho das ultimas 30 operacoes caiu significativamente em relacao ao historico." |
| Distribuido | "O lucro e bem distribuido entre as operacoes. Nao depende de poucos acertos grandes." |
| Concentrado | "Boa parte do lucro vem de poucas operacoes. Risco moderado de variancia." |
| Evento Raro | "O lucro depende de poucos eventos de alto retorno. Sem eles, o metodo seria negativo." |

### Detalhes tecnicos

O componente `ValidationBadge` recebera uma nova prop `tooltip: string` e ficara assim:

```text
function ValidationBadge({ icon, label, level, tooltip }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={...}>{icon}{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-center">
        <p className="text-xs">{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

Cada chamada de `ValidationBadge` passara o texto correspondente a classificacao atual. O bloco dos badges sera envolvido por `<TooltipProvider delayDuration={300}>`.

