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

export const useStatistics = (games: Game[], methods: Method[]) => {
  const statistics = useMemo(() => {
    // Filtrar apenas jogos finalizados
    const finalizedGames = games.filter((game) =>
      game.methodOperations.length > 0 && game.methodOperations.every((op) => op.result)
    );

    const allOperations = finalizedGames.flatMap((g) => g.methodOperations);

    // Estatísticas gerais
    const totalOperations = allOperations.length;
    const greenOperations = allOperations.filter((op) => op.result === 'Green').length;
    const redOperations = allOperations.filter((op) => op.result === 'Red').length;
    const winRate = totalOperations > 0 ? (greenOperations / totalOperations) * 100 : 0;

    const overallStats: OverallStats = {
      total: totalOperations,
      greens: greenOperations,
      reds: redOperations,
      winRate: parseFloat(winRate.toFixed(1)),
    };

    // Estatísticas por liga
    const leagueMap = new Map<string, { greens: number; reds: number }>();
    
    finalizedGames.forEach((game) => {
      if (!leagueMap.has(game.league)) {
        leagueMap.set(game.league, { greens: 0, reds: 0 });
      }
      const leagueData = leagueMap.get(game.league)!;
      
      game.methodOperations.forEach((op) => {
        if (op.result === 'Green') leagueData.greens++;
        if (op.result === 'Red') leagueData.reds++;
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
