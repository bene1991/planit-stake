

## Widget SofaScore com controle de corte ajustavel

### Problema
O corte fixo (marginTop: -60, height: 80) nao mostra as "bolinhas de gol" do widget e o usuario nao consegue ajustar a area visivel. Cada widget do SofaScore pode ter posicionamento diferente do grafico, entao valores fixos nao funcionam para todos os casos.

### Solucao
Adicionar controles de ajuste no modo de edicao (dentro do jogo expandido) para que o usuario possa:
- Ajustar o **corte superior** (quanto esconder do topo) com um slider
- Ajustar a **altura visivel** (quanto mostrar) com um slider
- Ver um preview em tempo real enquanto ajusta
- Os valores sao salvos junto com a URL do widget

### Alteracoes

**1. `src/types/index.ts`**
- Adicionar campos `sofascoreCropTop` e `sofascoreCropHeight` ao tipo Game para salvar os ajustes de corte por jogo

**2. `src/components/SofaScoreWidget.tsx`**
- Aceitar props `cropTop` e `cropHeight` (com defaults: cropTop=0, cropHeight=120)
- No modo `displayOnly`, usar esses valores para posicionar o iframe: `marginTop: -cropTop` e container `height: cropHeight`
- No modo de edicao, adicionar dois sliders:
  - "Corte superior" (0 a 200px) - controla o marginTop negativo
  - "Altura visivel" (60 a 250px) - controla a altura do container
- Mostrar preview do widget enquanto ajusta os sliders
- Chamar `onSave` com a URL e chamar novo callback `onCropChange` quando os sliders mudam

**3. `src/components/GameListItem.tsx`**
- Passar `cropTop` e `cropHeight` do game para o `SofaScoreWidget` em ambos os modos
- No modo de edicao (expandido), passar callbacks para salvar os valores de crop no game via `onUpdate`

### Detalhes tecnicos

No `SofaScoreWidget.tsx`, o modo de edicao tera:

```text
+------------------------------------------+
| SofaScore Widget                         |
| [URL input field........................] |
|                                          |
| Corte superior:  [======|====] 60px      |
| Altura visivel:  [===|=======] 120px     |
|                                          |
| +--------------------------------------+ |
| |  [preview do iframe com crop atual]  | |
| +--------------------------------------+ |
+------------------------------------------+
```

O iframe sempre renderiza com height="500" (grande), e a "janela" visivel e controlada pelo container com `overflow-hidden`, `height: cropHeight` e o iframe com `marginTop: -cropTop`.

No `displayOnly` os mesmos valores sao usados sem os controles.

Os valores default (cropTop=0, cropHeight=120) funcionam como ponto de partida, e o usuario ajusta ate ver exatamente as bolinhas de gol e o grafico que quer.
