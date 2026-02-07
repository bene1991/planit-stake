

## Corrigir Widget SofaScore - Fundo Preto e Indicadores de Gols/Cartoes

### Problemas Identificados

1. **Indicadores de gols e cartoes vermelhos nao aparecem** - O iframe do SofaScore esta sendo cortado de forma que esconde os icones de gol (circulos verdes) e cartoes vermelhos que ficam nas bordas do grafico de momentum. O corte lateral (`marginLeft: -16px`) e o corte superior (`marginTop`) podem estar removendo esses elementos visuais.

2. **Fundo nao esta preto** - O container usa `bg-card` que pode nao ser escuro o suficiente. A referencia mostra fundo completamente preto/escuro.

### Solucao

**Arquivo: `src/components/SofaScoreWidget.tsx`**

1. **Trocar background para preto** - Usar `bg-[#0D0D0D]` (seguindo o tema do site) em vez de `bg-card`
2. **Reduzir corte lateral** - Diminuir o `marginLeft` de `-16px` para `-4px` (e width para `calc(100% + 8px)`) para preservar os indicadores de gol e cartao que ficam nas extremidades do grafico
3. **Adicionar `colorScheme: 'normal'`** no style do iframe (ja existe, manter)
4. **Aumentar a altura padrao** - O `DEFAULT_CROP_HEIGHT` de 120px pode ser muito pequeno para mostrar os indicadores. Subir para 140px como padrao

### Detalhes Tecnicos

No `renderIframe`:
- Container: `className="relative group overflow-hidden rounded-lg bg-[#0D0D0D]"`  
- Iframe style: reduzir margens laterais para `-4px` / `calc(100% + 8px)` para nao cortar indicadores
- Aumentar `DEFAULT_CROP_HEIGHT` de 120 para 140

Isso preserva os indicadores visuais do SofaScore (gols, cartoes) enquanto mantem o fundo escuro combinando com o tema do site.

