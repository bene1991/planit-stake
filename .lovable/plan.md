

## Ajustar Widget SofaScore para ficar igual ao screenshot

### O que muda

O widget esta aparecendo grande demais (286px de altura). Para ficar igual ao screenshot com o "Momento de ataque" compacto, precisamos:

1. **Reduzir a altura do iframe** de 286px para ~120px, que e o tamanho real do widget de Attack Momentum compacto
2. **Remover a margem lateral esquerda** (`ml-12 sm:ml-14`) para o widget ocupar a largura completa do card, igual ao screenshot
3. **Ajustar o border-radius** para combinar com o visual escuro do card

### Arquivos a editar

**1. `src/components/SofaScoreWidget.tsx`**
- Mudar `height="286"` para `height="120"` no iframe do modo `displayOnly`
- Mudar `height="286"` para `height="120"` no iframe do modo de edicao (se existir preview)
- Adicionar `style={{ colorScheme: 'normal' }}` para evitar conflitos de tema

**2. `src/components/GameListItem.tsx`**
- Remover `ml-12 sm:ml-14` do container do widget para ocupar a largura toda
- Manter o `px-2 sm:px-3 pb-2` para padding lateral consistente

### Resultado esperado

O widget vai aparecer compacto, mostrando apenas o grafico de barras do "Momento de ataque" sem espaco vazio, ocupando a largura total do card do jogo.
