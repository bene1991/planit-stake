import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Database, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const STORAGE_KEYS = {
  games: 'j360-games',
  bankroll: 'j360-bankroll',
  migrated: 'j360-data-migrated',
};

export function DataMigration() {
  const { user } = useAuth();
  const [migrating, setMigrating] = useState(false);
  const [showAlert, setShowAlert] = useState<boolean>(() => {
    const migrated = localStorage.getItem(STORAGE_KEYS.migrated);
    const hasOldData = localStorage.getItem(STORAGE_KEYS.games) || localStorage.getItem(STORAGE_KEYS.bankroll);
    return !migrated && !!hasOldData;
  });

  const migrateData = async () => {
    if (!user) {
      toast.error('Você precisa estar logado para migrar dados');
      return;
    }

    setMigrating(true);

    try {
      // Migrate bankroll
      const bankrollData = localStorage.getItem(STORAGE_KEYS.bankroll);
      if (bankrollData) {
        const bankroll = JSON.parse(bankrollData);

        // Insert bankroll
        await supabase.from('bankroll').insert({
          owner_id: user.id,
          total: bankroll.total || 10000,
        });

        // Insert methods
        if (bankroll.methods && bankroll.methods.length > 0) {
          const methods = bankroll.methods.map((m: any) => ({
            owner_id: user.id,
            name: m.name,
            percentage: m.percentage,
          }));

          const { data: insertedMethods } = await supabase
            .from('methods')
            .insert(methods)
            .select();

          // Create a map of old IDs to new IDs
          const methodIdMap: { [key: string]: string } = {};
          bankroll.methods.forEach((oldMethod: any, index: number) => {
            if (insertedMethods && insertedMethods[index]) {
              methodIdMap[oldMethod.id] = insertedMethods[index].id;
            }
          });

          // Migrate games
          const gamesData = localStorage.getItem(STORAGE_KEYS.games);
          if (gamesData) {
            const games = JSON.parse(gamesData);

            for (const game of games) {
              const { data: insertedGame } = await supabase
                .from('games')
                .insert({
                  owner_id: user.id,
                  date: game.date,
                  time: game.time,
                  league: game.league,
                  home_team: game.homeTeam,
                  away_team: game.awayTeam,
                  notes: game.notes,
                  status: game.status || 'Not Started',
                })
                .select()
                .single();

              if (insertedGame && game.methodOperations && game.methodOperations.length > 0) {
                const operations = game.methodOperations.map((op: any) => ({
                  game_id: insertedGame.id,
                  method_id: methodIdMap[op.methodId] || op.methodId,
                  operation_type: op.operationType,
                  entry_odds: op.entryOdds,
                  exit_odds: op.exitOdds,
                  result: op.result,
                }));

                await supabase.from('method_operations').insert(operations);
              }
            }
          }
        }
      }

      // Mark as migrated
      localStorage.setItem(STORAGE_KEYS.migrated, 'true');
      setShowAlert(false);
      toast.success('Dados migrados com sucesso! Recarregando dados...');

      // Instead of hard reload, we can trigger a refresh via Supabase hooks if needed,
      // but usually the app will react to the localStorage change or session.
      // For safety, let's just let the user know.

    } catch (error) {
      console.error('Error migrating data:', error);
      toast.error('Erro ao migrar dados. Tente novamente.');
    } finally {
      setMigrating(false);
    }
  };

  if (!showAlert) return null;

  return (
    <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
      <AlertCircle className="h-4 w-4 text-orange-500" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-medium text-orange-700 dark:text-orange-400">
              Migração de Dados Necessária
            </p>
            <p className="mt-1 text-sm text-orange-600 dark:text-orange-300">
              Encontramos dados antigos no seu navegador. Clique no botão para vincular
              esses dados à sua conta.
            </p>
          </div>
          <Button
            onClick={migrateData}
            disabled={migrating}
            size="sm"
            className="ml-4"
          >
            <Database className="mr-2 h-4 w-4" />
            {migrating ? 'Migrando...' : 'Aplicar migração'}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
