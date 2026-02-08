

## Botao Pausar/Retomar Requisicoes na Pagina de Planejamento

### O que sera feito

Adicionar um botao toggle na barra de acoes da pagina de Planejamento que permite **pausar todas as requisicoes de API** (live scores + fixture cache) e **retomar** quando desejar. Ideal para momentos em que voce quer economizar creditos manualmente.

### Como funciona

1. Ao clicar em **Pausar**, todas as requisicoes param imediatamente (live scores e fixture cache)
2. O botao muda para **Retomar** com visual destacado (vermelho/amarelo)
3. Ao clicar em **Retomar**, o polling volta com o intervalo configurado
4. O estado persiste no `localStorage` para nao perder ao recarregar a pagina
5. Um indicador visual mostra que as requisicoes estao pausadas

### Arquivos a modificar

**1. Novo hook `src/hooks/useApiPause.ts`**
- Estado booleano `isPaused` salvo no `localStorage` (chave `apiPaused`)
- Funcoes `pause()`, `resume()`, `toggle()`
- Exporta o estado para ser consumido por `useLiveScores` e `useFixtureCache`

**2. `src/hooks/useLiveScores.ts`** (linhas 386-438)
- Receber novo parametro `paused?: boolean`
- Quando `paused === true`, nao iniciar o interval de polling e limpar o existente
- Ao retomar (`paused` volta para `false`), reiniciar o polling normalmente

**3. `src/hooks/useFixtureCache.ts`** (linhas 96-109)
- Receber novo parametro opcional `globalPaused?: boolean` (terceiro parametro)
- Quando `globalPaused === true`, nao disparar auto-refresh nem fetch inicial
- Ao retomar, voltar a buscar dados

**4. `src/pages/DailyPlanning.tsx`** (linhas 573-593)
- Importar e usar `useApiPause()`
- Passar `isPaused` para `useLiveScores`
- Adicionar botao Pausar/Retomar na barra de acoes (ao lado do botao Atualizar)
- Mostrar banner informativo quando pausado

**5. `src/components/GameListItem.tsx` e `src/components/GameCardCompact.tsx`**
- Receber prop `globalPaused` e passar para `useFixtureCache`

### Detalhes Tecnicos

**Novo hook `useApiPause`:**

```text
useApiPause():
  - isPaused: boolean (lido do localStorage 'apiPaused', default false)
  - toggle(): alterna isPaused e salva no localStorage
  - pause(): define isPaused = true
  - resume(): define isPaused = false
```

**Modificacao no `useLiveScores`:**

```text
// Linha 386-397 - adicionar verificacao de pausa
if (!isPageVisible || paused) {
  console.log('[useLiveScores] PAUSED by user - stopping API polling');
  return;
}
```

**Botao na UI (ao lado de Atualizar):**

```text
Quando ativo (nao pausado):
  [Pause icon] "Pausar API" - botao outline normal

Quando pausado:
  [Play icon] "Retomar API" - botao com fundo amarelo/vermelho pulsante
  + Banner: "Requisicoes pausadas - placares e estatisticas nao estao atualizando"
```

### Fluxo Visual

```text
Estado Normal:
  [Exportar] [Atualizar] [Pausar API] [Buscar Jogos]
  Ultima atualizacao: 14:30:25 - proxima em 18s

Estado Pausado:
  [Exportar] [Atualizar (desabilitado)] [► Retomar API (pulsando)] [Buscar Jogos]
  ⚠️ Requisicoes pausadas - clique em Retomar para voltar a atualizar
```

### O que para quando pausado

- Polling de placares ao vivo (`useLiveScores`)
- Fetch de estatisticas detalhadas (`useFixtureCache`)
- Auto-refresh do `useAutoRefresh`

### O que continua funcionando quando pausado

- Cronometro local dos jogos (conta baseado no horario do jogo)
- Todos os dados ja carregados continuam visiveis
- Botoes de Green/Red continuam funcionando
- Navegacao normal entre paginas

