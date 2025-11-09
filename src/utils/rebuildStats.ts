import { supabase } from '@/integrations/supabase/client';

interface StatsResult {
  totalGames: number;
  totalOperations: number;
  greens: number;
  reds: number;
  winRate: number;
  methodStats: {
    methodName: string;
    greens: number;
    reds: number;
    winRate: number;
  }[];
}

const calculateResult = (
  operationType: 'Back' | 'Lay',
  entryOdds: number,
  exitOdds: number
): 'Green' | 'Red' => {
  if (operationType === 'Back') {
    return exitOdds < entryOdds ? 'Green' : 'Red';
  } else {
    return exitOdds > entryOdds ? 'Green' : 'Red';
  }
};

export const rebuildStats = async (): Promise<StatsResult> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Buscar todos os jogos do usuário
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, owner_id')
      .eq('owner_id', user.id);

    if (gamesError) throw gamesError;

    // Buscar todas as operações
    const { data: operations, error: opsError } = await supabase
      .from('method_operations')
      .select('*, methods!inner(name)')
      .in('game_id', games?.map(g => g.id) || []);

    if (opsError) throw opsError;

    let totalUpdated = 0;
    const methodStatsMap = new Map<string, { greens: number; reds: number }>();

    // Recalcular e atualizar cada operação
    for (const op of operations || []) {
      if (op.operation_type && op.entry_odds && op.exit_odds) {
        const correctResult = calculateResult(
          op.operation_type as 'Back' | 'Lay',
          op.entry_odds,
          op.exit_odds
        );

        // Atualizar se resultado estiver incorreto
        if (op.result !== correctResult) {
          await supabase
            .from('method_operations')
            .update({ result: correctResult })
            .eq('id', op.id);
          totalUpdated++;
        }

        // Acumular stats por método
        const methodName = (op.methods as any)?.name || 'Unknown';
        if (!methodStatsMap.has(methodName)) {
          methodStatsMap.set(methodName, { greens: 0, reds: 0 });
        }
        const stats = methodStatsMap.get(methodName)!;
        if (correctResult === 'Green') stats.greens++;
        else stats.reds++;
      }
    }

    // Calcular estatísticas finais
    const totalOperations = operations?.length || 0;
    const totalGreens = Array.from(methodStatsMap.values()).reduce((sum, s) => sum + s.greens, 0);
    const totalReds = Array.from(methodStatsMap.values()).reduce((sum, s) => sum + s.reds, 0);
    const winRate = totalOperations > 0 ? (totalGreens / totalOperations) * 100 : 0;

    const methodStats = Array.from(methodStatsMap.entries()).map(([name, stats]) => ({
      methodName: name,
      greens: stats.greens,
      reds: stats.reds,
      winRate: stats.greens + stats.reds > 0 
        ? (stats.greens / (stats.greens + stats.reds)) * 100 
        : 0,
    }));

    console.log(`✅ Stats rebuilt: ${totalUpdated} operations updated`);

    return {
      totalGames: games?.length || 0,
      totalOperations,
      greens: totalGreens,
      reds: totalReds,
      winRate: parseFloat(winRate.toFixed(1)),
      methodStats,
    };
  } catch (error) {
    console.error('Error rebuilding stats:', error);
    throw error;
  }
};
