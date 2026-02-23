

## Corrigir: jogo adicionado manualmente deve ir para a lista de Aprovados

### Problema

Ao clicar "Adicionar manualmente" em um jogo reprovado, a analise e salva no banco com sucesso (toast "Analise salva!"), mas o card continua na secao "Reprovados" porque o estado local (`results`) nao e atualizado -- o campo `approved` permanece `false`.

### Solucao

Apos salvar com sucesso via `handleSave` (chamado pelo `onForceAdd`), atualizar o array `results` no estado local, marcando `approved = true` para o jogo correspondente. Isso faz o card migrar automaticamente de "Reprovados" para "Aprovados".

### Mudanca

**Arquivo**: `src/components/Lay0x1/Lay0x1Scanner.tsx`

Na funcao `handleSave` (linhas 321-336), apos o `saveAnalysis` retornar com sucesso, chamar `setResults` para atualizar o campo `approved` do jogo:

```text
De:
  const handleSave = async (result: AnalysisResult) => {
    setSavingId(result.fixture_id);
    await saveAnalysis({ ... });
    toast.success('Análise salva!');
    setSavingId(null);
  };

Para:
  const handleSave = async (result: AnalysisResult) => {
    setSavingId(result.fixture_id);
    await saveAnalysis({ ... });
    // Mover para lista de aprovados no estado local
    setResults(prev => prev.map(r =>
      r.fixture_id === result.fixture_id ? { ...r, approved: true } : r
    ));
    toast.success('Análise salva!');
    setSavingId(null);
  };
```

### Resultado

- Ao clicar "Adicionar manualmente", o card some da secao "Reprovados" e aparece na secao "Aprovados" instantaneamente
- O contador de aprovados/reprovados se atualiza automaticamente
- Nenhuma outra mudanca necessaria -- apenas 3 linhas adicionadas

### Arquivos modificados

- `src/components/Lay0x1/Lay0x1Scanner.tsx` (funcao `handleSave`)

