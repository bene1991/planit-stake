

## Correções: Void no relatório Telegram, botão de planejamento e enumeração

### 3 problemas identificados

---

### Problema 1 -- Botão "Telegram" (Planejamento) sumiu

**Causa:** Em `DailyPlanning.tsx` linha 726, o botão de planejamento do Telegram só aparece se existem jogos **pendentes** de hoje com métodos Lay 0x1/1x0:

```typescript
{buildTelegramGames(games.filter(g => g.date === todayDate), bankroll.methods).length > 0 && (
  <Button ... onClick={() => setShowTelegramModal(true)}>Telegram</Button>
)}
```

O filtro `games.filter(g => g.date === todayDate)` pega todos os jogos de hoje, mas `buildTelegramGames` inclui qualquer jogo com Lay 0x1/1x0. Porém, quando todos os jogos com esses métodos são finalizados (Green/Red/Void), eles saem de `sortedPlanned` (pendentes) e vão para `finalizedGames`. O problema é que a condição verifica `games` (todos), mas se nenhum jogo de hoje tem Lay 0x1/1x0, o botão some.

**Na verdade**, olhando de novo: `games` inclui TODOS os jogos (pendentes + finalizados). Então o botão deveria aparecer se existem jogos de hoje com Lay 0x1/1x0, independente do resultado. A função `buildTelegramGames` não filtra por resultado -- ela inclui todos.

O problema real é que se o usuário está olhando um dia diferente de hoje, o botão usa `todayDate` fixo e pode não ter jogos. Mas pelo screenshot o usuário está no dia correto.

**Fix:** Remover a condição que esconde o botão. O botão "Telegram" (planejamento) deve estar sempre visível, igual ao "Resumo".

---

### Problema 2 -- Jogos com Void "sumindo"

**Causa:** A lógica de separação pendentes/finalizados está correta (linhas 400-406). Quando todos os métodos de um jogo têm resultado (incluindo Void), o jogo vai para o histórico ("Finalizados"). O filtro padrão do histórico mostra "Hoje", mas se o jogo é de outro dia, ele fica invisível.

**Fix:** Garantir que a contagem de "Finalizados" na aba principal inclua jogos de hoje com Void. Além disso, no `GameStatusTabs`, a aba "Finalizados (0)" mostra 0 porque conta apenas jogos pendentes filtrados como finalizados -- mas os finalizados estão em `finalizedGames`, não em `sortedPlanned`. A aba "Finalizados" no topo filtra `sortedPlanned` (que só tem pendentes), então sempre mostra 0 para jogos completamente finalizados.

**O bug real:** A aba "Finalizados (0)" na seção de planejamento filtra `sortedPlanned`, que por definição só contém jogos pendentes. Jogos com todos os métodos finalizados (incluindo Void) estão em `finalizedGames` e aparecem apenas na seção "Histórico" colapsável abaixo. Precisamos incluir os jogos finalizados de hoje na aba "Finalizados" do planejamento para que o usuário os veja imediatamente.

---

### Problema 3 -- Enumerar jogos no relatório Telegram e incluir Voids

**Causa:** A função `buildSummaryMessage` não numera os jogos. Voids já são incluídos (linha 43: `if (!op.result) continue` pula apenas sem resultado, Void passa).

**Fix:** Adicionar numeração sequencial (1., 2., 3...) a cada jogo no relatório.

---

### Arquivos a modificar

**1. `src/pages/DailyPlanning.tsx`**

- **Linha 726**: Remover a condição `buildTelegramGames(...).length > 0` -- o botão "Telegram" deve estar sempre visível (igual ao "Resumo")
- **Linhas 831-876**: Na seção de planejamento, incluir jogos finalizados de hoje junto com os pendentes na aba "Finalizados", para que jogos com Void não "sumam" da tela principal
- Alterar `sortedPlanned` na aba "Finalizados" para incluir `finalizedGames` de hoje

**2. `src/components/TelegramSummaryMessage.tsx`**

- Na função `buildSummaryMessage`, adicionar numeração sequencial antes de cada jogo:
  - Mudar de `🏟 Team A x Team B` para `1. 🏟 Team A x Team B`
- Confirmar que Voids estão sendo incluídos (já estão)

### Detalhes técnicos

**DailyPlanning.tsx -- Botão Telegram sempre visível:**
```typescript
// ANTES (linha 726-731):
{buildTelegramGames(games.filter(...)).length > 0 && (
  <Button ...>Telegram</Button>
)}

// DEPOIS:
<Button variant="outline" size="sm" onClick={() => setShowTelegramModal(true)} className="h-8">
  <Send className="h-3.5 w-3.5 sm:mr-2" />
  <span className="hidden sm:inline">Telegram</span>
</Button>
```

**DailyPlanning.tsx -- Mostrar finalizados de hoje na seção principal:**
```typescript
// Criar lista combinada para as abas que inclui finalizados de hoje
const todayFinalizedGames = finalizedGames.filter(g => g.date === todayDate);
const planningViewGames = [...sortedPlanned, ...todayFinalizedGames.sort(...)];
```

**TelegramSummaryMessage.tsx -- Enumerar jogos:**
```typescript
// ANTES:
for (const item of items) {
  msg += `\n🏟 ${item.homeTeam} x ${item.awayTeam}`;

// DEPOIS:
for (let i = 0; i < items.length; i++) {
  const item = items[i];
  msg += `\n${i + 1}. 🏟 ${item.homeTeam} x ${item.awayTeam}`;
```
