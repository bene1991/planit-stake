import { useMemo } from 'react';
import { Game, Method } from '@/types';

interface OverallStats {
  total: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface LeagueStats {
  league: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
  profit: number;
  averageOdd: number;
}

interface TeamStats {
  team: string;
  gamesCount: number;
  operations: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface MethodStats {
  methodId: string;
  methodName: string;
  total: number;
  greens: number;
  reds: number;
  winRate: number;
}

interface TimelineData {
  date: string;
  greens: number;
  reds: number;
  cumulative: number;
}

// Função para calcular resultado correto baseado no tipo de operação
const calculateResult = (op: { operationType?: 'Back' | 'Lay'; entryOdds?: number; exitOdds?: number }): 'Green' | 'Red' | null => {
  if (!op.entryOdds || !op.exitOdds || !op.operationType) return null;
  
  if (op.operationType === 'Back') {
    // Back: Green se odd de saída < entrada
    return op.exitOdds < op.entryOdds ? 'Green' : 'Red';
  } else {
    // Lay: Green se odd de saída > entrada
    return op.exitOdds > op.entryOdds ? 'Green' : 'Red';
  }
};

export const useStatistics = (games: Game[], methods: Method[]) => {
  const statistics = useMemo(() => {
    // Filtrar apenas jogos finalizados
    const finalizedGames = games.filter((game) =>
      game.methodOperations.length > 0 && game.methodOperations.every((op) => op.result)
    );

    const allOperations = finalizedGames.flatMap((g) => g.methodOperations);

    // Estatísticas gerais (usando resultado registrado ou calculando)
    const totalOperations = allOperations.length;
    const greenOperations = allOperations.filter((op) => {
      const result = op.result || calculateResult(op);
      return result === 'Green';
    }).length;
    const redOperations = allOperations.filter((op) => {
      const result = op.result || calculateResult(op);
      return result === 'Red';
    }).length;
    // Win Rate excludes Voids from denominator
    const decidedOperations = greenOperations + redOperations;
    const winRate = decidedOperations > 0 ? (greenOperations / decidedOperations) * 100 : 0;

    const overallStats: OverallStats = {
      total: totalOperations,
      greens: greenOperations,
      reds: redOperations,
      winRate: parseFloat(winRate.toFixed(1)),
    };

    // Estatísticas por liga
    const leagueMap = new Map<string, { 
      greens: number; 
      reds: number; 
      profit: number;
      totalOdds: number;
      oddsCount: number;
    }>();
    
    finalizedGames.forEach((game) => {
      if (!leagueMap.has(game.league)) {
        leagueMap.set(game.league, { greens: 0, reds: 0, profit: 0, totalOdds: 0, oddsCount: 0 });
      }
      const leagueData = leagueMap.get(game.league)!;
      
      game.methodOperations.forEach((op) => {
        if (op.result === 'Green') leagueData.greens++;
        if (op.result === 'Red') leagueData.reds++;
        
        // Average odd
        if (op.odd && op.odd > 0) {
          leagueData.totalOdds += op.odd;
          leagueData.oddsCount++;
        }
        
        // Profit in stakes
        if (op.profit !== undefined && op.profit !== null && op.stakeValue && op.stakeValue > 0) {
          leagueData.profit += op.profit / op.stakeValue;
        } else if (op.result === 'Green') {
          leagueData.profit += op.odd && op.odd > 0 ? op.odd - 1 : 0;
        } else if (op.result === 'Red') {
          leagueData.profit -= 1;
        }
      });
    });

    const leagueStats: LeagueStats[] = Array.from(leagueMap.entries())
      .map(([league, data]) => {
        const total = data.greens + data.reds;
        const winRate = total > 0 ? (data.greens / total) * 100 : 0;
        return {
          league,
          total,
          greens: data.greens,
          reds: data.reds,
          winRate: parseFloat(winRate.toFixed(1)),
          profit: parseFloat(data.profit.toFixed(2)),
          averageOdd: data.oddsCount > 0 ? parseFloat((data.totalOdds / data.oddsCount).toFixed(2)) : 0,
        };
      })
      .sort((a, b) => b.winRate - a.winRate);

    // Estatísticas por time (casa e fora)
    const teamMap = new Map<string, { gamesCount: number; operations: number; greens: number; reds: number }>();
    
    finalizedGames.forEach((game) => {
      [game.homeTeam, game.awayTeam].forEach((team) => {
        if (!teamMap.has(team)) {
          teamMap.set(team, { gamesCount: 0, operations: 0, greens: 0, reds: 0 });
        }
        const teamData = teamMap.get(team)!;
        teamData.gamesCount++;
        
        game.methodOperations.forEach((op) => {
          teamData.operations++;
          if (op.result === 'Green') teamData.greens++;
          if (op.result === 'Red') teamData.reds++;
        });
      });
    });

    const teamStats: TeamStats[] = Array.from(teamMap.entries())
      .map(([team, data]) => {
        const winRate = data.operations > 0 ? (data.greens / data.operations) * 100 : 0;
        return {
          team,
          gamesCount: data.gamesCount,
          operations: data.operations,
          greens: data.greens,
          reds: data.reds,
          winRate: parseFloat(winRate.toFixed(1)),
        };
      })
      .filter((stat) => stat.gamesCount >= 2) // Mostrar apenas times com 2+ jogos
      .sort((a, b) => b.winRate - a.winRate);

    // Estatísticas por método
    const methodStats: MethodStats[] = methods.map((method) => {
      const methodOps = allOperations.filter((op) => op.methodId === method.id);
      const methodGreens = methodOps.filter((op) => op.result === 'Green').length;
      const methodReds = methodOps.filter((op) => op.result === 'Red').length;
      const methodTotal = methodOps.length;
      const methodWinRate = methodTotal > 0 ? (methodGreens / methodTotal) * 100 : 0;

      return {
        methodId: method.id,
        methodName: method.name,
        total: methodTotal,
        greens: methodGreens,
        reds: methodReds,
        winRate: parseFloat(methodWinRate.toFixed(1)),
      };
    }).filter((stat) => stat.total > 0);

    // Timeline de resultados
    const timelineMap = new Map<string, { greens: number; reds: number }>();
    
    finalizedGames.forEach((game) => {
      const dateKey = game.date;
      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { greens: 0, reds: 0 });
      }
      const dayData = timelineMap.get(dateKey)!;
      
      game.methodOperations.forEach((op) => {
        if (op.result === 'Green') dayData.greens++;
        if (op.result === 'Red') dayData.reds++;
      });
    });

    const timeline: TimelineData[] = Array.from(timelineMap.entries())
      .map(([date, data]) => ({
        date,
        greens: data.greens,
        reds: data.reds,
        cumulative: data.greens - data.reds,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calcular cumulativo correto
    let cumulativeSum = 0;
    timeline.forEach((item) => {
      cumulativeSum += item.greens - item.reds;
      item.cumulative = cumulativeSum;
    });

    return {
      overallStats,
      leagueStats,
      teamStats,
      methodStats,
      timeline,
    };
  }, [games, methods]);

  return statistics;
};
