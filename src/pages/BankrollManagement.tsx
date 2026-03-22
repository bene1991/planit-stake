import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { useSupabaseGames } from "@/hooks/useSupabaseGames";
import { useFilteredStatistics } from "@/hooks/useFilteredStatistics";
import { BankrollEvolutionChart } from "@/components/Charts/BankrollEvolutionChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, TrendingUp, RefreshCw, Pencil, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { MethodEditor } from "@/components/MethodEditor";

export default function BankrollManagement() {
  const { bankroll, isLoading, updateTotal, addMethod, updateMethod, deleteMethod, atualizarIndicesConfianca, moveMethod } = useSupabaseBankroll();
  const { games } = useSupabaseGames();
  const noFilters = useMemo(() => ({ dateFrom: null, dateTo: null, selectedMethods: [] as string[], selectedLeagues: [] as string[], period: 'all' as const, result: 'all' as const }), []);
  const { bankrollEvolution } = useFilteredStatistics(games, bankroll.methods, noFilters);
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodPercentage, setNewMethodPercentage] = useState("");
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleAddMethod = () => {
    if (!newMethodName.trim()) {
      toast.error("Digite um nome para o método");
      return;
    }
    const percentage = parseFloat(newMethodPercentage);
    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
      toast.error("Percentual inválido (0-100)");
      return;
    }

    const totalPercentage = bankroll.methods.reduce((sum, m) => sum + m.percentage, 0);
    if (totalPercentage + percentage > 100) {
      toast.error("A soma dos percentuais não pode exceder 100%");
      return;
    }

    addMethod({ name: newMethodName, percentage });
    setNewMethodName("");
    setNewMethodPercentage("");
    toast.success("Método adicionado com sucesso!");
  };

  const totalAllocated = bankroll.methods.reduce((sum, m) => sum + m.percentage, 0);
  const remainingPercentage = 100 - totalAllocated;

  const getConfiancaColor = (indice?: number) => {
    if (!indice) return 'bg-gray-500';
    if (indice >= 70) return 'bg-green-600';
    if (indice >= 40) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const getConfiancaLabel = (indice?: number) => {
    if (!indice) return 'Sem dados';
    if (indice >= 70) return 'Alta';
    if (indice >= 40) return 'Média';
    return 'Baixa';
  };

  const handleEditMethod = (methodId: string, updates: { name: string; percentage: number }) => {
    updateMethod(methodId, updates);
    toast.success("Método atualizado com sucesso!");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Gestão de Banca</h1>
          <p className="text-muted-foreground">Gerencie sua banca e distribua entre os métodos</p>
        </div>
      </div>

      <Card className="p-6 shadow-card">
        <div className="space-y-4">
          <div>
            <Label htmlFor="total" className="text-base font-semibold">
              Valor Total da Banca
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-2xl font-medium text-muted-foreground">R$</span>
              <Input
                id="total"
                type="number"
                value={bankroll.total}
                onChange={(e) => updateTotal(parseFloat(e.target.value) || 0)}
                className="text-2xl font-bold"
                placeholder="0,00"
              />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatCurrency(bankroll.total)} disponíveis
            </p>
          </div>
        </div>
      </Card>

      <BankrollEvolutionChart data={bankrollEvolution} />

      {/* Barra de Alocação Total */}
      {bankroll.methods.length > 0 && (
        <Card className="p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Alocação Total</h3>
            <span className={cn("text-sm font-bold", totalAllocated > 100 ? "text-destructive" : totalAllocated === 100 ? "text-emerald-500" : "text-muted-foreground")}>
              {totalAllocated.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", totalAllocated > 100 ? "bg-destructive" : totalAllocated === 100 ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${Math.min(totalAllocated, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {remainingPercentage > 0 ? `${remainingPercentage.toFixed(1)}% disponível` : totalAllocated === 100 ? 'Totalmente alocado' : 'Excedeu o limite'}
          </p>
          {/* Mini allocation bars per method */}
          <div className="mt-3 space-y-1.5">
            {bankroll.methods.map((method) => (
              <div key={method.id} className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-24 truncate">{method.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${method.percentage}%` }} />
                </div>
                <span className="text-[11px] font-medium w-10 text-right">{method.percentage}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 shadow-card">
        <h2 className="mb-4 text-xl font-bold">Adicionar Método</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="method-name">Nome do Método</Label>
            <Input
              id="method-name"
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              placeholder="Ex: Under Limit, Lay 0x0"
            />
          </div>
          <div>
            <Label htmlFor="method-percentage">Porcentagem da Banca (%)</Label>
            <Input
              id="method-percentage"
              type="number"
              value={newMethodPercentage}
              onChange={(e) => setNewMethodPercentage(e.target.value)}
              placeholder="0"
              min="0"
              max="100"
              step="0.1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Disponível: {remainingPercentage.toFixed(1)}%
            </p>
          </div>
          <Button onClick={handleAddMethod} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Método
          </Button>
        </div>
      </Card>

      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Matriz de Confiança dos Métodos</h2>
          <Button onClick={atualizarIndicesConfianca} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar Confiança
          </Button>
        </div>
        {bankroll.methods.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            Nenhum método cadastrado. Adicione um método para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {bankroll.methods.map((method) => {
              const amount = (bankroll.total * method.percentage) / 100;
              const indice = method.indice_confianca || 0;
              return (
                <div
                  key={method.id}
                  className="flex items-center justify-between rounded-lg border bg-gradient-card p-4 transition-shadow hover:shadow-hover"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{method.name}</p>
                      <Badge className={getConfiancaColor(indice)}>
                        Confiança: {indice.toFixed(0)}% - {getConfiancaLabel(indice)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {method.percentage}% • {formatCurrency(amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={bankroll.methods.indexOf(method) === 0}
                        onClick={() => moveMethod(bankroll.methods.indexOf(method), 'up')}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={bankroll.methods.indexOf(method) === bankroll.methods.length - 1}
                        onClick={() => moveMethod(bankroll.methods.indexOf(method), 'down')}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEditingMethod(method);
                        setIsEditorOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        deleteMethod(method.id);
                        toast.success("Método removido");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <MethodEditor
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        method={editingMethod}
        onConfirm={handleEditMethod}
        loading={isLoading}
        remainingPercentage={remainingPercentage}
      />
    </div>
  );
}
