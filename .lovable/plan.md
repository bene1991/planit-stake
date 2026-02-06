

## Tooltips Explicativos nos Scores LDI do Jogo Ao Vivo

### O que muda

Melhorar os tooltips dos scores LDI (Live Dominance Index) que aparecem ao lado de cada time no card do jogo ao vivo. Em vez de mostrar apenas "Dominando - LDI 10/100", o tooltip vai explicar o que aquele numero significa de forma clara e contextualizada.

### Arquivo a editar

**`src/components/LiveDominanceDisplay.tsx`**

### Conteudo dos tooltips

Os tooltips serao dinamicos, combinando a classificacao do time com uma explicacao do que o LDI representa:

| Faixa LDI | Classificacao | Tooltip |
|-----------|--------------|---------|
| 60-100 | Dominando | "LDI {valor}/100 - {time} domina o jogo. Controla posse, finaliza mais e pressiona o adversario. Indice baseado em posse de bola, chutes, chutes no gol e escanteios." |
| 40-59 | Equilibrado | "LDI {valor}/100 - Jogo equilibrado para {time}. Nenhum time tem dominio claro. Indice baseado em posse de bola, chutes, chutes no gol e escanteios." |
| 0-39 | Sendo dominado | "LDI {valor}/100 - {time} esta sendo dominado. Adversario controla as acoes do jogo. Indice baseado em posse de bola, chutes, chutes no gol e escanteios." |

Tambem sera adicionado tooltip na barra de dominancia (barra verde/roxa) e no sparkline para contextualizar melhor.

### Detalhes tecnicos

- Alterar os `TooltipContent` existentes nas linhas 97-99 (home) e 128-130 (away) para incluir texto explicativo mais completo
- Adicionar tooltip na barra de dominancia (linhas 135-145) explicando o que a barra representa
- Usar `max-w-[260px]` nos tooltips para acomodar o texto maior
- Manter `cursor-help` nos elementos interativos

Exemplo da mudanca no tooltip do time da casa:

```text
<TooltipContent side="top" className="max-w-[260px]">
  <p className="text-[10px] font-semibold mb-0.5">{homeTeam} - LDI {homeLdi}/100</p>
  <p className="text-[10px] text-muted-foreground">
    {explicacao baseada na faixa do LDI}
  </p>
  <p className="text-[10px] text-muted-foreground mt-0.5">
    Calculado a partir de posse de bola, chutes, chutes no gol e escanteios.
  </p>
</TooltipContent>
```

Tooltip da barra de dominancia:

```text
<TooltipContent side="bottom" className="max-w-[240px]">
  <p className="text-[10px]">Barra de dominancia: verde = controle da casa, roxo = controle do visitante. Quanto maior a faixa, maior o dominio.</p>
</TooltipContent>
```

