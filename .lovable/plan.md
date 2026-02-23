

## Remover as 3 ligas bloqueadas incorretamente

### Situacao Atual

- A validacao no codigo (`calibrate-lay0x1`) ja foi aplicada com sucesso -- futuras calibracoes nao vao bloquear ligas sem reds
- Porem as 3 ligas bloqueadas anteriormente ainda estao na tabela `lay0x1_blocked_leagues`:
  - **Eerste Divisie** (auto_ia)
  - **Friendlies Clubs** (auto_ia)
  - **Professional Development League** (auto_ia)

### O que falta

Executar um DELETE na tabela `lay0x1_blocked_leagues` para remover essas 3 ligas que foram bloqueadas pela IA sem justificativa (0 reds).

```text
DELETE FROM lay0x1_blocked_leagues
WHERE league_name IN ('Eerste Divisie', 'Friendlies Clubs', 'Professional Development League')
  AND reason = 'auto_ia';
```

### Resultado Esperado

- As 3 ligas voltam a ser analisadas pelo scanner
- A validacao no backend impede que a IA bloqueie novamente ligas sem reds
- Nenhuma outra alteracao de codigo necessaria

