# Robô Auditor de Alertas (Audit Robot)

Este componente atua como uma camada de segurança (fail-safe) para o sistema de alertas de futebol.

## Como Funciona
O Robô Auditor executa uma lógica independente e paralela à `live-robot-cron`. Seu objetivo é identificar cenários onde:
1. Um jogo possui estatísticas que atendem aos requisitos de uma variação ativa.
2. NENHUM alerta foi encontrado na tabela `live_alerts` para esse fixture + variação.
3. O jogo foi possivelmente descartado indevidamente por um erro de lógica ou técnico.

## Fluxo de Execução
- **Busca**: Coleta todos os jogos ao vivo da API-Football.
- **Avaliação**: Aplica os filtros de variação (minutos, gols, chutes).
- **Cross-check**: Verifica se existe registro em `live_alerts`.
- **Causa Raiz**: Se detectado um alerta ausente, consulta o `robot_execution_logs` para entender por que a função principal descartou o jogo.
- **Notificação**: Envia um relatório consolidado ("RELATÓRIO DE AUDITORIA") para o Telegram do administrador se discrepâncias forem encontradas.

## Relatório de Auditoria
Exemplo de alerta enviado:
```
🔎 RELATÓRIO DE AUDITORIA

❌ ALERTA AUSENTE: Flamengo vs Palmeiras
⭐ Variação: Chute 5/2
📝 Motivo: Logged as VARIATION_EVALUATION: Discarded by filters (Estatísticas não bateram no momento X)
```

Este robô garante que o usuário tenha visibilidade total sobre a "saúde" do robô de apostas.
