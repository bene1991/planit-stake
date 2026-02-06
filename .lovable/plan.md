

## Modo de Teste para Analise de Dominancia

### Problema

O indicador de dominancia so aparece para jogos ao vivo (`isLive`), mas neste momento os unicos jogos com dados estatisticos reais no cache ja terminaram. Precisamos de uma forma de visualizar e validar o indicador usando dados reais existentes.

### Solucao

Remover temporariamente a restricao de "apenas ao vivo" no `GameListItem`, permitindo que jogos finalizados com `api_fixture_id` e dados no cache tambem exibam o indicador de dominancia. Isso funciona como modo de teste permanente e tambem agrega valor real -- o usuario pode ver a dominancia de jogos passados.

### Abordagem

Em vez de um "modo demo" temporario, faz mais sentido mostrar o indicador para **qualquer jogo que tenha dados no cache**, independente do status. Jogos "Not Started" sem dados simplesmente nao mostram nada (como ja funciona). Jogos finalizados com dados mostram a analise pos-jogo.

### Arquivo a Editar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/GameListItem.tsx` | Remover a condicao `isLive &&` do render do `DominanceIndicator`, mantendo apenas a verificacao de `api_fixture_id` existir |

### Detalhe Tecnico

Mudanca minima no `GameListItem.tsx`:

**Antes:**
```
{isLive && game.api_fixture_id && (
  <DominanceIndicator ... />
)}
```

**Depois:**
```
{game.api_fixture_id && (
  <DominanceIndicator ... />
)}
```

O proprio `useDominanceAnalysis` ja lida com todos os cenarios:
- Jogo sem dados: mostra "Aguardando estatisticas..." ou "Liga sem cobertura"
- Jogo com dados: mostra LDI, barra, sparkline e alertas
- Jogo finalizado com dados: mostra a analise completa (validacao visual)

### Jogo para Teste

**RED Star FC 93 vs PAU** (France - Ligue 2)
- fixture_id: 1396831
- Posse: 53% x 47%
- Chutes: 11 x 1 (2 no gol)
- Escanteios: 5 x 0
- Esperado: LDI alto para a casa (~70+), alertas de pressao alta

### Resultado

Apos a mudanca, o indicador aparecera nesse jogo finalizado com todos os dados visuais (barra de dominancia, valor LDI, tooltips). Isso permite validar que tudo funciona corretamente e tambem agrega valor para jogos passados.

