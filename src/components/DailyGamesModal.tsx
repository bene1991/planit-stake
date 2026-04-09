import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DailyGamesTab } from "./DailyGamesTab";
import { useDailyGames } from "@/hooks/useDailyGames";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DailyGamesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddGames: (gameIds: string[]) => Promise<void>;
}

export const DailyGamesModal = ({ open, onOpenChange, onAddGames }: DailyGamesModalProps) => {
  const { dailyGames, loading, loadDailyGames, clearDailyGames } = useDailyGames();

  const handleClear = async () => {
    try {
      await clearDailyGames();
      toast.success("Lista de jogos importados limpa com sucesso!");
    } catch (error) {
      toast.error("Erro ao limpar jogos importados.");
    }
  };

  const handleAddSelected = async (gameIds: string[]) => {
    try {
      await onAddGames(gameIds);
      // O DailyPlanning deve chamar o refreshGames e o markAsAdded no hook useDailyGames se necessário
      // Mas para simplificar, o DailyPlanning pode lidar com tudo e depois pedimos para o modal dar refresh
      await loadDailyGames();
    } catch (error) {
      console.error("Error adding games from CSV:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <DialogTitle>Jogos Importados (CSV)</DialogTitle>
            <DialogDescription>
              Selecione os jogos importados via CSV para adicionar ao seu planejamento diário.
            </DialogDescription>
          </div>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Lista
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar todos os jogos importados?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação removerá permanentemente todos os jogos que foram importados via CSV. 
                  Os jogos que já foram adicionados ao planejamento não serão afetados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Limpar Tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          <DailyGamesTab 
            dailyGames={dailyGames}
            loading={loading}
            onRefresh={loadDailyGames}
            onAddToPlanning={handleAddSelected}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
