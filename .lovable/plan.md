

## Corrigir Backtest 90 Dias -- Analise Automatica dos Dias Faltantes

### O Problema

Quando voce seleciona "90d", o sistema apenas le os resultados ja salvos no cache local (localStorage). Se voce so tinha analisado 30 dias antes, ele encontra ~32 dias de dados e mostra apenas esses. Os outros ~58 dias aparecem como "faltantes" e existe um botao para analisa-los, mas ele nao e acionado automaticamente.

### A Solucao

Fazer o sistema **iniciar automaticamente** a analise dos dias faltantes quando voce seleciona um range (7d, 15d, 30d, 90d). Assim, ao clicar em "90d", ele carrega os dias que ja tem em cache e imediatamente comeca a analisar os dias que faltam, sem precisar clicar em nenhum botao adicional.

### Detalhes Tecnicos

**Arquivo**: `src/components/Lay0x1/Lay0x1Scanner.tsx`

1. **Auto-analise ao trocar de range**: Adicionar um `useEffect` que, ao detectar dias faltantes apos selecionar um range, dispara automaticamente a funcao `analyzeMissingDays()`.

2. **Feedback visual melhorado**: Mostrar claramente no topo quantos dias ja estao carregados e quantos estao sendo analisados (ex: "Carregando: 32/90 dias... Analisando 58 faltantes").

3. **Manter botao manual como fallback**: O botao "Analisar X dia(s) faltante(s)" continua disponivel caso a analise automatica seja interrompida.

### Resultado

- Ao clicar "90d", o sistema carrega os dias em cache e automaticamente comeca a buscar os faltantes
- Barra de progresso mostra o avanco em tempo real
- Ao finalizar, todos os 90 dias estarao analisados e visiveis

