import { useState } from 'react';
import { useEstrategias } from '@/hooks/useEstrategias';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { EstrategiaForm } from '@/components/EstrategiaForm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Estrategia } from '@/types';
import { EmptyState } from '@/components/EmptyState';

export default function Estrategias() {
  const { estrategias, loading, addEstrategia, updateEstrategia, deleteEstrategia } = useEstrategias();
  const { bankroll } = useSupabaseBankroll();
  const [showForm, setShowForm] = useState(false);
  const [editingEstrategia, setEditingEstrategia] = useState<Estrategia | null>(null);

  const handleSubmit = async (data: Omit<Estrategia, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => {
    if (editingEstrategia) {
      await updateEstrategia(editingEstrategia.id, data);
      toast.success('Estratégia atualizada!');
      setEditingEstrategia(null);
    } else {
      await addEstrategia(data);
      toast.success('Estratégia criada!');
    }
    setShowForm(false);
  };

  const handleEdit = (estrategia: Estrategia) => {
    setEditingEstrategia(estrategia);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta estratégia?')) {
      await deleteEstrategia(id);
      toast.success('Estratégia removida');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingEstrategia(null);
  };

  const getMethodName = (metodoId: string) => {
    const method = bankroll.methods.find(m => m.id === metodoId);
    return method?.name || 'Método não encontrado';
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Target className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Estratégias</h1>
            <p className="text-muted-foreground">Crie e gerencie suas estratégias de trading</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Estratégia
        </Button>
      </div>

      {showForm && (
        <EstrategiaForm
          methods={bankroll.methods}
          editingEstrategia={editingEstrategia}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {estrategias.length === 0 ? (
        <EmptyState
          icon={<Target className="h-8 w-8 text-muted-foreground" />}
          title="Nenhuma estratégia cadastrada"
          description="Crie estratégias para automatizar suas entradas e otimizar seu trading"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {estrategias.map((estrategia) => (
            <Card key={estrategia.id} className="p-6 shadow-card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">{estrategia.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getMethodName(estrategia.metodo_id)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(estrategia)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(estrategia.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {estrategia.descricao && (
                <p className="text-sm text-muted-foreground mb-4">{estrategia.descricao}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={estrategia.tipo_operacao === 'Back' ? 'default' : 'secondary'}>
                    {estrategia.tipo_operacao}
                  </Badge>
                  {estrategia.odd_minima && estrategia.odd_maxima && (
                    <span className="text-sm text-muted-foreground">
                      Odds: {estrategia.odd_minima} - {estrategia.odd_maxima}
                    </span>
                  )}
                </div>

                {estrategia.stake_valor && (
                  <div className="text-sm">
                    <span className="font-medium">Stake: </span>
                    {estrategia.stake_tipo === 'percentual' 
                      ? `${estrategia.stake_valor}% da banca` 
                      : `R$ ${estrategia.stake_valor.toFixed(2)}`
                    }
                  </div>
                )}

                {(estrategia.tempo_minuto_inicial !== undefined || estrategia.tempo_minuto_final !== undefined) && (
                  <div className="text-sm">
                    <span className="font-medium">Tempo: </span>
                    {estrategia.tempo_minuto_inicial || 0}' - {estrategia.tempo_minuto_final || 90}'
                  </div>
                )}

                {estrategia.condicoes_entrada && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <p className="text-xs font-medium mb-1">Condições de Entrada:</p>
                    <p className="text-xs text-muted-foreground">{estrategia.condicoes_entrada}</p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
