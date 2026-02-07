import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useFixtureSearch } from "./useFixtureSearch";

export interface MethodOperation {
  methodId: string;
  operationType?: 'Back' | 'Lay';
  entryOdds?: number;
  exitOdds?: number;
  result?: 'Green' | 'Red';
  stakeValue?: number;
  odd?: number;
  profit?: number;
  commissionRate?: number;
}

export interface GoalEvent {
  teamId: number;
  playerName: string;
  minute: number;
  detail?: string;
}

export interface Game {
  id: string;
  date: string;
  time: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  methodOperations: MethodOperation[];
  notes?: string;
  status?: string;
  api_fixture_id?: string;
  goalEvents?: GoalEvent[];
  finalScoreHome?: number;
  finalScoreAway?: number;
  bttsYes?: number;
  bttsNo?: number;
  bttsBookmaker?: string;
  bttsIsBetfair?: boolean;
  bttsFetchedAt?: string;
  sofascoreUrl?: string;
}

const GAMES_QUERY_KEY = ['games'] as const;

// Optimized single query to fetch all games with operations
const fetchGamesWithOperations = async (userId: string): Promise<Game[]> => {
  // Fetch games and operations in parallel
  const [gamesResult, operationsResult] = await Promise.all([
    supabase.from('games').select('*').eq('owner_id', userId),
    supabase.from('method_operations').select('*'),
  ]);

  if (gamesResult.error) {
    console.error('Error loading games:', gamesResult.error);
    throw gamesResult.error;
  }

  const gamesData = gamesResult.data || [];
  const allOperations = operationsResult.data || [];

  // Create a map of operations by game_id for O(1) lookup
  const operationsByGameId = new Map<string, typeof allOperations>();
  allOperations.forEach((op) => {
    const gameOps = operationsByGameId.get(op.game_id) || [];
    gameOps.push(op);
    operationsByGameId.set(op.game_id, gameOps);
  });

  // Map games with their operations
  return gamesData.map((game) => {
    const gameOperations = operationsByGameId.get(game.id) || [];
    
    const methodOperations: MethodOperation[] = gameOperations.map(op => ({
      methodId: op.method_id,
      operationType: op.operation_type as 'Back' | 'Lay' | undefined,
      entryOdds: op.entry_odds ? Number(op.entry_odds) : undefined,
      exitOdds: op.exit_odds ? Number(op.exit_odds) : undefined,
      result: op.result as 'Green' | 'Red' | undefined,
      stakeValue: op.stake_value ? Number(op.stake_value) : undefined,
      odd: op.odd ? Number(op.odd) : undefined,
      profit: op.profit ? Number(op.profit) : undefined,
      commissionRate: op.commission_rate ? Number(op.commission_rate) : undefined,
    }));

    const rawGoalEvents = game.goal_events;
    const goalEvents = Array.isArray(rawGoalEvents) ? (rawGoalEvents as unknown as GoalEvent[]) : undefined;

    return {
      id: game.id,
      date: game.date,
      time: game.time,
      league: game.league,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      homeTeamLogo: game.home_team_logo || undefined,
      awayTeamLogo: game.away_team_logo || undefined,
      notes: game.notes || undefined,
      status: game.status || 'Not Started',
      api_fixture_id: game.api_fixture_id || undefined,
      goalEvents,
      finalScoreHome: game.final_score_home ?? undefined,
      finalScoreAway: game.final_score_away ?? undefined,
      methodOperations,
      bttsYes: game.btts_yes ? Number(game.btts_yes) : undefined,
      bttsNo: game.btts_no ? Number(game.btts_no) : undefined,
      bttsBookmaker: game.btts_bookmaker || undefined,
      bttsIsBetfair: game.btts_is_betfair || false,
      bttsFetchedAt: game.btts_fetched_at || undefined,
      sofascoreUrl: game.sofascore_url || undefined,
    };
  });
};

export const useSupabaseGames = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { autoLinkGame } = useFixtureSearch();

  // Use React Query with staleTime to prevent refetching on tab switch
  const { data: games = [], isLoading: loading, refetch } = useQuery({
    queryKey: [...GAMES_QUERY_KEY, user?.id],
    queryFn: () => fetchGamesWithOperations(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - won't refetch if data is less than 5 min old
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    refetchOnWindowFocus: false, // Don't refetch when switching tabs
    refetchOnMount: false, // Don't refetch when component mounts if data exists
  });

  const addGameMutation = useMutation({
    mutationFn: async (game: Omit<Game, "id">) => {
      if (!user) throw new Error('Not authenticated');

      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .insert({
          owner_id: user.id,
          date: game.date,
          time: game.time,
          league: game.league,
          home_team: game.homeTeam,
          away_team: game.awayTeam,
          home_team_logo: game.homeTeamLogo,
          away_team_logo: game.awayTeamLogo,
          notes: game.notes,
          status: game.status || 'Not Started',
          api_fixture_id: game.api_fixture_id,
          btts_yes: game.bttsYes,
          btts_no: game.bttsNo,
          btts_bookmaker: game.bttsBookmaker,
          btts_is_betfair: game.bttsIsBetfair,
          btts_fetched_at: game.bttsFetchedAt,
          sofascore_url: game.sofascoreUrl,
        })
        .select()
        .single();

      if (gameError) throw gameError;

      if (gameData && game.methodOperations.length > 0) {
        const operations = game.methodOperations.map(op => ({
          game_id: gameData.id,
          method_id: op.methodId,
          operation_type: op.operationType,
          entry_odds: op.entryOdds,
          exit_odds: op.exitOdds,
          result: op.result,
          stake_value: op.stakeValue,
          odd: op.odd,
          profit: op.profit,
          commission_rate: op.commissionRate,
        }));

        await supabase.from('method_operations').insert(operations);
      }

      // Auto-link to API-Football
      if (gameData) {
        try {
          const result = await autoLinkGame(
            gameData.id,
            game.homeTeam,
            game.awayTeam,
            game.date
          );
          return { gameData, linked: result.success };
        } catch {
          return { gameData, linked: false };
        }
      }

      return { gameData, linked: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: GAMES_QUERY_KEY });
      if (result.linked) {
        toast.success('Jogo adicionado e vinculado à API!');
      } else {
        toast.success('Jogo adicionado!');
      }
    },
    onError: () => {
      toast.error('Erro ao adicionar jogo');
    },
  });

  const updateGameMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Game> }) => {
      if (!user) throw new Error('Not authenticated');

      const gameUpdates: Record<string, unknown> = {};
      if (updates.date) gameUpdates.date = updates.date;
      if (updates.time) gameUpdates.time = updates.time;
      if (updates.league) gameUpdates.league = updates.league;
      if (updates.homeTeam) gameUpdates.home_team = updates.homeTeam;
      if (updates.awayTeam) gameUpdates.away_team = updates.awayTeam;
      if (updates.homeTeamLogo !== undefined) gameUpdates.home_team_logo = updates.homeTeamLogo;
      if (updates.awayTeamLogo !== undefined) gameUpdates.away_team_logo = updates.awayTeamLogo;
      if (updates.notes !== undefined) gameUpdates.notes = updates.notes;
      if (updates.status) gameUpdates.status = updates.status;
      if (updates.goalEvents !== undefined) gameUpdates.goal_events = updates.goalEvents;
      if (updates.finalScoreHome !== undefined) gameUpdates.final_score_home = updates.finalScoreHome;
      if (updates.finalScoreAway !== undefined) gameUpdates.final_score_away = updates.finalScoreAway;
      if (updates.sofascoreUrl !== undefined) gameUpdates.sofascore_url = updates.sofascoreUrl;

      if (Object.keys(gameUpdates).length > 0) {
        const { error: gameError } = await supabase
          .from('games')
          .update(gameUpdates)
          .eq('id', id)
          .eq('owner_id', user.id);

        if (gameError) throw gameError;
      }

      if (updates.methodOperations) {
        await supabase.from('method_operations').delete().eq('game_id', id);

        if (updates.methodOperations.length > 0) {
          const operations = updates.methodOperations.map(op => ({
            game_id: id,
            method_id: op.methodId,
            operation_type: op.operationType,
            entry_odds: op.entryOdds,
            exit_odds: op.exitOdds,
            result: op.result,
            stake_value: op.stakeValue,
            odd: op.odd,
            profit: op.profit,
            commission_rate: op.commissionRate,
          }));

          await supabase.from('method_operations').insert(operations);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_QUERY_KEY });
      toast.success('Jogo atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar jogo');
    },
  });

  const deleteGameMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAMES_QUERY_KEY });
      toast.success('Jogo removido!');
    },
    onError: () => {
      toast.error('Erro ao deletar jogo');
    },
  });

  const addGame = async (game: Omit<Game, "id">) => {
    await addGameMutation.mutateAsync(game);
  };

  const updateGame = async (id: string, updates: Partial<Game>) => {
    await updateGameMutation.mutateAsync({ id, updates });
  };

  const deleteGame = async (id: string) => {
    await deleteGameMutation.mutateAsync(id);
  };

  const refreshGames = async () => {
    await refetch();
  };

  return {
    games,
    loading,
    addGame,
    updateGame,
    deleteGame,
    refreshGames,
  };
};
