

## Campo de Widget SofaScore por Jogo

### O que muda

Cada jogo vai ter um campo opcional onde voce pode colar o link do widget da SofaScore (ex: `https://widgets.sofascore.com/pt-BR/embed/attackMomentum?id=15238929&widgetTheme=light`). Quando preenchido, o mapa de pressao aparece dentro da area expandida do jogo.

### Como funciona

1. Voce expande o jogo (clica na seta)
2. Abaixo dos botoes de Green/Red e das notas, aparece um campo de texto para colar o link da SofaScore
3. Ao colar e salvar, o iframe do widget aparece ali mesmo, mostrando o Attack Momentum em tempo real

### Arquivos a editar

**1. `src/types/index.ts`**
- Adicionar campo opcional `sofascoreUrl?: string` na interface `Game`

**2. `src/components/GameListItem.tsx`**
- Na area expandida (CollapsibleContent), adicionar:
  - Um input de texto para colar/editar o link da SofaScore
  - Um iframe que renderiza o widget quando a URL esta preenchida
  - Botao para limpar o link

**3. `src/hooks/useSupabaseGames.ts`**
- Garantir que o campo `sofascoreUrl` e salvo/carregado do banco (via coluna `sofascore_url` na tabela de jogos)

**4. Migracao de banco de dados**
- Adicionar coluna `sofascore_url TEXT` na tabela de jogos (nullable, sem default)

### Detalhes tecnicos

Na area expandida do GameListItem, apos as notas:

```text
// Input para colar URL
<input 
  placeholder="Cole o link do widget SofaScore..."
  value={sofascoreUrl}
  onChange={...}
  onBlur={() => onUpdate(game.id, { sofascoreUrl })}
/>

// Iframe do widget (quando URL existe)
{game.sofascoreUrl && (
  <iframe
    src={game.sofascoreUrl}
    width="100%"
    height="286"
    frameBorder="0"
    scrolling="no"
    sandbox="allow-scripts allow-same-origin"
  />
)}
```

O campo aceita qualquer URL de widget da SofaScore. Voce vai no site da SofaScore, copia o link do embed do Attack Momentum do jogo que quer, e cola no campo. O widget aparece em tempo real dentro do seu app.

### Seguranca

O iframe usa `sandbox="allow-scripts allow-same-origin"` para limitar o que o widget externo pode fazer no seu site.

