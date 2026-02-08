

## Voz "Jogo Comecando Agora" com Web Speech API

### O que sera feito

Quando um jogo mudar para status **Live** (minuto 0), o navegador vai falar **"Jogo comecando agora!"** usando a voz nativa do dispositivo. Sem API externa, sem custo, funciona offline.

### Arquivos a modificar

**1. `src/utils/soundManager.ts`** - Adicionar funcao `playGameStartVoice()`
- Usa `window.speechSynthesis.speak()` com lingua `pt-BR`
- Debounce de 30 segundos para evitar repeticoes
- Volume e velocidade configuraveis
- Tenta selecionar voz em portugues automaticamente

**2. `src/hooks/useNotifications.ts`** - Adicionar campo `voiceAlerts` nas preferencias
- Novo booleano no `NotificationPreferences` (default: `true`)
- Adicionado ao `DEFAULT_PREFERENCES`

**3. `src/components/NotificationCenter.tsx`** - Chamar voz ao detectar jogo Live
- No bloco existente onde `previousGame.status !== 'Live' && game.status === 'Live'` (linha ~208), chamar `playGameStartVoice()` se `preferences.voiceAlerts` estiver ativo

**4. `src/components/NotificationSettings.tsx`** - Adicionar toggle e botao de teste
- Switch "Voz de inicio de jogo" na secao de Alertas de Jogos
- Botao "Testar voz" para ouvir o resultado antes de um jogo real

### Detalhes tecnicos

Nova funcao em `soundManager.ts`:

```text
let lastVoiceTime = 0;
const VOICE_DEBOUNCE = 30000; // 30s

playGameStartVoice():
  1. Verifica se window.speechSynthesis existe
  2. Verifica debounce (30s desde ultima execucao)
  3. Cria SpeechSynthesisUtterance("Jogo comecando agora!")
  4. Define lang = "pt-BR", rate = 1.0, volume = 1.0
  5. Busca voz pt-BR na lista de vozes disponiveis
  6. Executa speechSynthesis.speak(utterance)
```

Integracao no NotificationCenter (linha ~208-220):

```text
// Game went Live
if (preferences.gameLive && previousGame.status !== 'Live' && game.status === 'Live') {
  // ... notificacao existente ...
  
  // NOVO: Voz de inicio
  if (preferences.voiceAlerts) {
    playGameStartVoice();
  }
}
```

### Vantagens

- Zero custo (API nativa do navegador)
- Zero configuracao (sem API key)
- Funciona offline
- Toggle independente para ativar/desativar

