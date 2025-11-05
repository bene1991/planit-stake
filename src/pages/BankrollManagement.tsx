import { useState } from "react";
import { useSupabaseBankroll } from "@/hooks/useSupabaseBankroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function BankrollManagement() {
  const { bankroll, loading, updateTotal, addMethod, updateMethod, deleteMethod, atualizarIndicesConfianca } = useSupabaseBankroll();
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodPercentage, setNewMethodPercentage] = useState("");

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

  if (loading) {
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
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={method.percentage}
                      onChange={(e) =>
                        updateMethod(method.id, { percentage: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 text-right"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
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
    </div>
  );
}
