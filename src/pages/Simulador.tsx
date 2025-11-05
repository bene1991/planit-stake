import { useState } from 'react';
import { useSimulacoes } from '@/hooks/useSimulacoes';
import { useSupabaseBankroll } from '@/hooks/useSupabaseBankroll';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FlaskConical, CheckCircle, XCircle, Target } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';

export default function Simulador() {
  const { simulacoes, loading, addSimulacao, deleteSimulacao } = useSimulacoes();
  const { bankroll } = useSupabaseBankroll();
  
  const [showForm, setShowForm] = useState(false);
  const [nomeSessao, setNomeSessao] = useState('');
  const [metodoId, setMetodoId] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState<'Back' | 'Lay'>('Back');
  const [oddEntrada, setOddEntrada] = useState('');
  const [oddSaida, setOddSaida] = useState('');
  const [resultado, setResultado] = useState<'Green' | 'Red' | ''>('');
  const [comentarios, setComentarios] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!metodoId || !resultado) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    await addSimulacao({
      data: new Date().toISOString(),
      nome_sessao: nomeSessao,
      metodo_id: metodoId,
      tipo_operacao: tipoOperacao,
      odd_entrada: oddEntrada ? parseFloat(oddEntrada) : undefined,
      odd_saida: oddSaida ? parseFloat(oddSaida) : undefined,
      resultado: resultado as 'Green' | 'Red',
      comentarios: comentarios || undefined,
    });

    toast.success('Simulação registrada!');
    
    // Reset form
    setNomeSessao('');
    setMetodoId('');
    setOddEntrada('');
    setOddSaida('');
    setResultado('');
    setComentarios('');
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta simulação?')) {
      await deleteSimulacao(id);
      toast.success('Simulação removida');
    }
  };

  const getMethodName = (metodoId: string) => {
    const method = bankroll.methods.find(m => m.id === metodoId);
    return method?.name || 'Método não encontrado';
  };

  // Calcular estatísticas das simulações
  const totalSimulacoes = simulacoes.length;
  const greens = simulacoes.filter(s => s.resultado === 'Green').length;
  const reds = simulacoes.filter(s => s.resultado === 'Red').length;
  const winRate = totalSimulacoes > 0 ? ((greens / totalSimulacoes) * 100).toFixed(1) : '0.0';

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
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600">
            <FlaskConical className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Simulador de Sessão</h1>
            <p className="text-muted-foreground">Teste suas estratégias sem afetar a banca real</p>
          </div>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Nova Simulação
        </Button>
      </div>

      {totalSimulacoes > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            label="Total de Simulações"
            value={totalSimulacoes}
            icon={<Target className="h-5 w-5" />}
          />
          <StatCard
            label="Greens"
            value={greens}
            icon={<CheckCircle className="h-5 w-5 text-green-600" />}
            className="text-green-600"
          />
          <StatCard
            label="Reds"
            value={reds}
            icon={<XCircle className="h-5 w-5 text-red-600" />}
            className="text-red-600"
          />
          <StatCard
            label="Win Rate"
            value={`${winRate}%`}
            icon={<Target className="h-5 w-5" />}
          />
        </div>
      )}

      {showForm && (
        <Card className="p-6 shadow-card border-blue-200 bg-blue-50/50">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-blue-600">Modo Simulação</Badge>
            <h2 className="text-lg font-bold">Nova Simulação</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="nome-sessao">Nome da Sessão</Label>
                <Input
                  id="nome-sessao"
                  value={nomeSessao}
                  onChange={(e) => setNomeSessao(e.target.value)}
                  placeholder="Ex: Teste Estratégia X"
                  required
                />
              </div>

              <div>
                <Label htmlFor="metodo">Método *</Label>
                <Select value={metodoId} onValueChange={setMetodoId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um método" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankroll.methods.map((method) => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <Label htmlFor="tipo-operacao">Tipo</Label>
                <Select value={tipoOperacao} onValueChange={(v) => setTipoOperacao(v as 'Back' | 'Lay')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Back">Back</SelectItem>
                    <SelectItem value="Lay">Lay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="odd-entrada">Odd Entrada</Label>
                <Input
                  id="odd-entrada"
                  type="number"
                  step="0.01"
                  value={oddEntrada}
                  onChange={(e) => setOddEntrada(e.target.value)}
                  placeholder="2.00"
                />
              </div>

              <div>
                <Label htmlFor="odd-saida">Odd Saída</Label>
                <Input
                  id="odd-saida"
                  type="number"
                  step="0.01"
                  value={oddSaida}
                  onChange={(e) => setOddSaida(e.target.value)}
                  placeholder="1.80"
                />
              </div>

              <div>
                <Label htmlFor="resultado">Resultado *</Label>
                <Select value={resultado} onValueChange={(v) => setResultado(v as 'Green' | 'Red')} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Green">Green</SelectItem>
                    <SelectItem value="Red">Red</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="comentarios">Comentários</Label>
              <Textarea
                id="comentarios"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Observações sobre esta simulação..."
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Registrar Simulação
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {simulacoes.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-8 w-8 text-muted-foreground" />}
          title="Nenhuma simulação registrada"
          description="Comece a testar suas estratégias sem risco para a banca real"
        />
      ) : (
        <div className="space-y-3">
          {simulacoes.map((simulacao) => (
            <Card key={simulacao.id} className="p-4 shadow-card border-blue-200 bg-blue-50/30">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-600">Simulação</Badge>
                    <h3 className="font-semibold">{simulacao.nome_sessao}</h3>
                    <Badge variant={simulacao.resultado === 'Green' ? 'default' : 'destructive'}>
                      {simulacao.resultado}
                    </Badge>
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span><strong>Método:</strong> {getMethodName(simulacao.metodo_id)}</span>
                      <span><strong>Tipo:</strong> {simulacao.tipo_operacao}</span>
                      {simulacao.odd_entrada && (
                        <span><strong>Entrada:</strong> {simulacao.odd_entrada}</span>
                      )}
                      {simulacao.odd_saida && (
                        <span><strong>Saída:</strong> {simulacao.odd_saida}</span>
                      )}
                      <span className="text-xs">
                        {new Date(simulacao.data).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {simulacao.comentarios && (
                      <p className="text-muted-foreground italic">{simulacao.comentarios}</p>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(simulacao.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
