

## Tooltips nos Scores de Confiança, Risco e Edge

### O que muda

Adicionar tooltips explicativos nos 3 scores (Confiança, Risco, Edge) no card de cada método na aba Análise de Método. Ao passar o mouse, o usuário verá uma explicação do que aquela pontuação significa para aquele método específico.

### Arquivo a editar

**`src/components/MethodAnalysis/MethodAnalysisCard.tsx`**

### Tooltips por score

| Score | Explicação |
|-------|-----------|
| Confiança | "Mede a confiabilidade estatística do método. Quanto maior, mais dados consistentes sustentam os resultados. Baseado em volume de operações e estabilidade dos resultados." |
| Risco | "Indica o nível de risco do método. Quanto maior, mais volatilidade e drawdowns foram observados. Considere o tamanho das sequências negativas e a variação das odds." |
| Edge | "Representa a vantagem real do método sobre o mercado. Positivo significa que o Win Rate supera o breakeven das odds. Negativo indica que o mercado está vencendo." |

### Implementação

- Envolver cada bloco de score (Confiança, Risco, Edge) com `Tooltip` / `TooltipTrigger` / `TooltipContent`
- Reutilizar o `TooltipProvider` já existente no componente (dos selos de validação) movendo-o para envolver todo o card
- Adicionar `cursor-help` nos labels dos scores para indicar que há informação extra

### Detalhes técnicos

Cada seção de score (linhas 92-113) será envolvida assim:

```text
<Tooltip>
  <TooltipTrigger asChild>
    <div className="space-y-2 cursor-help">
      ... score existente ...
    </div>
  </TooltipTrigger>
  <TooltipContent side="top" className="max-w-[240px]">
    <p className="text-xs">Texto explicativo</p>
  </TooltipContent>
</Tooltip>
```

O `TooltipProvider` será movido para envolver todo o conteúdo do card, servindo tanto aos scores quanto aos selos de validação existentes.

