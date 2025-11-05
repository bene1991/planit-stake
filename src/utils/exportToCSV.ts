import { Game, Method } from '@/types';

export const exportGamesToCSV = (games: Game[], methods: Method[]) => {
  // Cabeçalho do CSV
  const headers = [
    'Data',
    'Hora',
    'Liga',
    'Time Casa',
    'Time Fora',
    'Status',
    'Método',
    'Tipo Operação',
    'Odd Entrada',
    'Odd Saída',
    'Resultado',
    'Observações'
  ];

  // Preparar linhas de dados
  const rows = games.flatMap(game => {
    if (game.methodOperations.length === 0) {
      // Jogo sem operações
      return [[
        game.date,
        game.time,
        game.league,
        game.homeTeam,
        game.awayTeam,
        game.status || 'Not Started',
        '-',
        '-',
        '-',
        '-',
        '-',
        game.notes || '-'
      ]];
    }

    // Jogo com operações (uma linha por operação)
    return game.methodOperations.map(op => {
      const method = methods.find(m => m.id === op.methodId);
      return [
        game.date,
        game.time,
        game.league,
        game.homeTeam,
        game.awayTeam,
        game.status || 'Not Started',
        method?.name || 'Desconhecido',
        op.operationType || '-',
        op.entryOdds?.toFixed(2) || '-',
        op.exitOdds?.toFixed(2) || '-',
        op.result || 'Pendente',
        game.notes || '-'
      ];
    });
  });

  // Converter para formato CSV
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Criar blob e fazer download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `planejamento_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
