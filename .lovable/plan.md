

## Corrigir Widget SofaScore - 400 Bad Request e impossibilidade de editar

### Problemas identificados

1. **400 Bad Request**: O atributo `sandbox` do iframe esta bloqueando requisicoes necessarias para o widget funcionar. O SofaScore precisa de permissoes adicionais como `allow-popups` e `allow-forms`. A solucao mais segura e remover o sandbox para widgets do SofaScore, ja que o iframe ja esta limitado por politicas de same-origin do navegador.

2. **Nao consegue colar de novo**: Quando a URL ja esta salva e o widget mostra erro, o campo de input some porque o componente detecta que ja tem uma URL. O usuario precisa expandir o jogo e clicar no botao X para limpar, mas isso nao esta obvio. Vamos melhorar para que o usuario possa clicar no iframe com erro para editar novamente.

### Alteracoes

**1. `src/components/SofaScoreWidget.tsx`**

- Remover o atributo `sandbox` do iframe (ele impede o widget de carregar corretamente)
- No modo `displayOnly`, envolver o iframe em um container clicavel que permita ao usuario clicar para editar/limpar
- No modo de edicao, garantir que o input aparece mesmo quando ja existe uma URL (para permitir re-colar)

**2. `src/components/GameListItem.tsx`**

- Passar a funcao `onSave` correta no `displayOnly` mode tambem, para que o widget possa ser editado/limpo diretamente do card principal
- Adicionar um botao de "editar/remover" visivel sobre o widget quando ele esta em erro ou quando o usuario passa o mouse

### Detalhes tecnicos

No `SofaScoreWidget.tsx`:
- Remover `sandbox="allow-scripts allow-same-origin"` - esta propriedade bloqueia requisicoes do widget para subdominios do SofaScore (Cloudflare retorna 400)
- No modo `displayOnly`, adicionar um botao X flutuante no canto superior direito para limpar a URL
- No modo de edicao (expanded), sempre mostrar o input com a URL atual para facilitar re-colagem

No `GameListItem.tsx`:
- Passar a funcao real de `onUpdate` para o `SofaScoreWidget` no modo `displayOnly`, permitindo limpar a URL sem precisar expandir o jogo

