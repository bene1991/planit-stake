import { useState, useEffect } from "react";
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
}

export const useSupabaseGames = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const { autoLinkGame } = useFixtureSearch();

  useEffect(() => {
    if (user) {
      loadGames();
    }
  }, [user]);

  const loadGames = async () => {
    if (!user) return;

    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .eq('owner_id', user.id);

    if (gamesError) {
      console.error('Error loading games:', gamesError);
      setLoading(false);
      return;
    }

    if (gamesData) {
      // Load operations for each game
      const gamesWithOperations = await Promise.all(
        gamesData.map(async (game) => {
          const { data: operations } = await supabase
            .from('method_operations')
            .select('*')
            .eq('game_id', game.id);

          const methodOperations: MethodOperation[] = operations?.map(op => ({
            methodId: op.method_id,
            operationType: op.operation_type as 'Back' | 'Lay' | undefined,
            entryOdds: op.entry_odds ? Number(op.entry_odds) : undefined,
            exitOdds: op.exit_odds ? Number(op.exit_odds) : undefined,
            result: op.result as 'Green' | 'Red' | undefined,
            stakeValue: op.stake_value ? Number(op.stake_value) : undefined,
            odd: op.odd ? Number(op.odd) : undefined,
            profit: op.profit ? Number(op.profit) : undefined,
            commissionRate: op.commission_rate ? Number(op.commission_rate) : undefined,
          })) || [];

          // Parse goal_events from jsonb
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
          };
        })
      );

      setGames(gamesWithOperations);
    }
    setLoading(false);
  };

  const addGame = async (game: Omit<Game, "id">) => {
    if (!user) return;

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
      })
      .select()
      .single();

    if (gameError) {
      toast.error('Erro ao adicionar jogo');
      console.error('Error adding game:', gameError);
      return;
    }

    if (gameData) {
      // Add operations
      if (game.methodOperations.length > 0) {
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
      try {
        const result = await autoLinkGame(
          gameData.id,
          game.homeTeam,
          game.awayTeam,
          game.date
        );
        
        if (result.success) {
          toast.success('Jogo adicionado e vinculado à API!');
        } else {
          toast.success('Jogo adicionado! (Vinculação manual disponível)');
        }
      } catch (err) {
        console.log('Auto-link failed, continuing without link:', err);
        toast.success('Jogo adicionado!');
      }

      await loadGames();
    }
  };

  const updateGame = async (id: string, updates: Partial<Game>) => {
    if (!user) return;

    const gameUpdates: any = {};
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

    const { error: gameError } = await supabase
      .from('games')
      .update(gameUpdates)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (gameError) {
      toast.error('Erro ao atualizar jogo');
      console.error('Error updating game:', gameError);
      return;
    }

    // Update operations if provided
    if (updates.methodOperations) {
      // Delete existing operations
      await supabase
        .from('method_operations')
        .delete()
        .eq('game_id', id);

      // Insert new operations
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

    await loadGames();
    toast.success('Jogo atualizado!');
  };

  const deleteGame = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) {
      toast.error('Erro ao deletar jogo');
      console.error('Error deleting game:', error);
      return;
    }

    await loadGames();
    toast.success('Jogo removido!');
  };

  return {
    games,
    loading,
    addGame,
    updateGame,
    deleteGame,
    refreshGames: loadGames,
  };
};
