
## Melhoria na Deteccao de Ausencia de Dados da API

### Diagnostico

O sistema esta funcionando corretamente. Os 3 jogos ao vivo atuais sao de ligas com cobertura estatistica limitada na API-Football:

- **Portugal - Segunda Liga** (Chaves vs Penafiel) - min 90
- **Chile - Copa Chile** (Magallanes vs Deportes Santa Cruz) - min 50
- **Uruguay - Primera Division** (Albion FC vs Liverpool Montevideo) - min 11

A API retorna o placar e minuto do jogo, mas `stats_raw: []` e `events_raw: []` - ou seja, **nao fornece estatisticas detalhadas** (posse, chutes, escanteios) para essas competicoes. Isso e uma limitacao conhecida da API-Football para ligas menores.

O indicador 🔴 esta correto ao sinalizar ausencia de dados. Porem, a mensagem pode ser melhorada.

---

### Melhorias Propostas

#### 1. Mensagem mais especifica no `useDominanceAnalysis`

Diferenciar dois cenarios:

| Cenario | Condicao | Mensagem |
|---------|----------|----------|
| Jogo sem cobertura | `minute_now > 10` E stats zeradas | "Liga sem cobertura estatistica detalhada" |
| Dados pendentes | `minute_now <= 10` E stats zeradas | "Aguardando estatisticas..." |
| Cache nao carregado | `fixtureCache === null` | "Carregando dados..." |

Isso evita que o usuario pense que ha um bug quando na verdade a API simplesmente nao cobre aquela liga.

#### 2. Icone e visual ajustados

- Cenario "sem cobertura": Mostrar icone de info (em vez de erro) com texto explicativo
- Cenario "dados pendentes": Mostrar loading spinner
- Cenario "sem dados": Manter 🔴 atual

---

### Detalhes Tecnicos

#### Arquivo a editar: `src/hooks/useDominanceAnalysis.ts`

Na funcao `analyzeDataStatus`, adicionar logica para detectar "sem cobertura":

```text
Se fixtureCache existe E minute_now > 10 E stats totalmente zeradas:
  -> status: 'no_coverage'
  -> mensagem: "Liga sem cobertura estatistica detalhada"

Se fixtureCache existe E minute_now <= 10 E stats zeradas:
  -> status: 'unavailable' (pode ser que ainda nao comecou)
  -> mensagem: "Aguardando estatisticas..."

Se fixtureCache === null:
  -> status: 'unavailable'
  -> mensagem: "Carregando dados..."
```

#### Arquivo a editar: `src/components/DominanceIndicator.tsx`

Ajustar o render para o novo status `no_coverage`:
- Usar badge cinza (neutro) em vez de vermelho
- Mostrar icone de informacao (Info) em vez de alerta
- Texto: "Esta liga nao possui cobertura estatistica detalhada na API"

#### Arquivo a editar: `src/components/GameListItem.tsx`

Nenhuma mudanca necessaria - ja consome o resultado do hook corretamente.

---

### Resultado Esperado

Para jogos de ligas menores (Uruguay, Chile, Portugal Segunda Liga, etc.):
- O usuario vera uma mensagem **informativa neutra** explicando que a liga nao tem cobertura
- Nao parecera um erro ou falha do sistema
- Para jogos de grandes ligas (Serie A, Premier League, La Liga), o indicador aparecera normalmente com os dados de dominancia
