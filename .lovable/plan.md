

## Corrigir aparencia do Widget SofaScore para tema escuro

### Problema
O iframe do SofaScore carrega com fundo branco/claro, quebrando o visual do site escuro. Na imagem de referencia, o widget aparece com fundo escuro combinando com o tema.

### Solucao

**Arquivo: `src/components/SofaScoreWidget.tsx`**

1. **Forcar tema escuro no iframe** - Adicionar o parametro `widgetTheme=dark` na URL do SofaScore automaticamente (se a URL nao tiver esse parametro)
2. **Background escuro no container** - Adicionar `bg-[#1a1a2e]` (ou similar ao tom do site) no container do iframe para que durante o carregamento nao apareca branco
3. **Arredondar bordas** - Adicionar `rounded-lg` no container com `overflow-hidden` para combinar com os cards do site
4. **Remover borda clara** - Remover o overlay de borda `border-border/10` que adiciona uma linha clara desnecessaria

### Detalhes tecnicos

Na funcao `renderIframe`, o container tera:
- `className="relative group overflow-hidden rounded-lg bg-[#1a1a2e]"` 
- Remover o div de overlay com borda

Na URL do iframe, antes de passar ao `src`, adicionar logica:
```
function ensureDarkTheme(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  if (!url.includes('widgetTheme=')) {
    return url + separator + 'widgetTheme=dark';
  }
  return url;
}
```

Isso faz o SofaScore renderizar no tema escuro nativamente, combinando com o fundo do site.

