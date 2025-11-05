import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Method, Estrategia } from '@/types';
import { X } from 'lucide-react';

interface EstrategiaFormProps {
  methods: Method[];
  editingEstrategia?: Estrategia | null;
  onSubmit: (data: Omit<Estrategia, 'id' | 'owner_id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

export const EstrategiaForm = ({ methods, editingEstrategia, onSubmit, onCancel }: EstrategiaFormProps) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [metodoId, setMetodoId] = useState('');
  const [tipoOperacao, setTipoOperacao] = useState<'Back' | 'Lay'>('Back');
  const [oddMinima, setOddMinima] = useState('');
  const [oddMaxima, setOddMaxima] = useState('');
  const [stakeTipo, setStakeTipo] = useState<'fixa' | 'percentual'>('percentual');
  const [stakeValor, setStakeValor] = useState('');
  const [tempoMinutoInicial, setTempoMinutoInicial] = useState('');
  const [tempoMinutoFinal, setTempoMinutoFinal] = useState('');
  const [condicoesEntrada, setCondicoesEntrada] = useState('');

  useEffect(() => {
    if (editingEstrategia) {
      setNome(editingEstrategia.nome);
      setDescricao(editingEstrategia.descricao || '');
      setMetodoId(editingEstrategia.metodo_id);
      setTipoOperacao(editingEstrategia.tipo_operacao || 'Back');
      setOddMinima(editingEstrategia.odd_minima?.toString() || '');
      setOddMaxima(editingEstrategia.odd_maxima?.toString() || '');
      setStakeTipo(editingEstrategia.stake_tipo || 'percentual');
      setStakeValor(editingEstrategia.stake_valor?.toString() || '');
      setTempoMinutoInicial(editingEstrategia.tempo_minuto_inicial?.toString() || '');
      setTempoMinutoFinal(editingEstrategia.tempo_minuto_final?.toString() || '');
      setCondicoesEntrada(editingEstrategia.condicoes_entrada || '');
    }
  }, [editingEstrategia]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      nome,
      descricao: descricao || undefined,
      metodo_id: metodoId,
      tipo_operacao: tipoOperacao,
      odd_minima: oddMinima ? parseFloat(oddMinima) : undefined,
      odd_maxima: oddMaxima ? parseFloat(oddMaxima) : undefined,
      stake_tipo: stakeTipo,
      stake_valor: stakeValor ? parseFloat(stakeValor) : undefined,
      tempo_minuto_inicial: tempoMinutoInicial ? parseInt(tempoMinutoInicial) : undefined,
      tempo_minuto_final: tempoMinutoFinal ? parseInt(tempoMinutoFinal) : undefined,
      condicoes_entrada: condicoesEntrada || undefined,
    });
  };

  return (
    <Card className="p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          {editingEstrategia ? 'Editar Estratégia' : 'Nova Estratégia'}
        </h2>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="nome">Nome da Estratégia *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Entrada Favorito HT"
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
                {methods.map((method) => (
                  <SelectItem key={method.id} value={method.id}>
                    {method.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva quando usar esta estratégia..."
            rows={2}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="tipo-operacao">Tipo de Operação</Label>
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
            <Label htmlFor="odd-minima">Odd Mínima</Label>
            <Input
              id="odd-minima"
              type="number"
              step="0.01"
              value={oddMinima}
              onChange={(e) => setOddMinima(e.target.value)}
              placeholder="1.50"
            />
          </div>

          <div>
            <Label htmlFor="odd-maxima">Odd Máxima</Label>
            <Input
              id="odd-maxima"
              type="number"
              step="0.01"
              value={oddMaxima}
              onChange={(e) => setOddMaxima(e.target.value)}
              placeholder="3.00"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="stake-tipo">Tipo de Stake</Label>
            <Select value={stakeTipo} onValueChange={(v) => setStakeTipo(v as 'fixa' | 'percentual')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual da Banca</SelectItem>
                <SelectItem value="fixa">Valor Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="stake-valor">
              Valor do Stake {stakeTipo === 'percentual' ? '(%)' : '(R$)'}
            </Label>
            <Input
              id="stake-valor"
              type="number"
              step={stakeTipo === 'percentual' ? '0.1' : '0.01'}
              value={stakeValor}
              onChange={(e) => setStakeValor(e.target.value)}
              placeholder={stakeTipo === 'percentual' ? '5' : '50.00'}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="tempo-inicial">Tempo Inicial (min)</Label>
            <Input
              id="tempo-inicial"
              type="number"
              value={tempoMinutoInicial}
              onChange={(e) => setTempoMinutoInicial(e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="tempo-final">Tempo Final (min)</Label>
            <Input
              id="tempo-final"
              type="number"
              value={tempoMinutoFinal}
              onChange={(e) => setTempoMinutoFinal(e.target.value)}
              placeholder="45"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="condicoes">Condições de Entrada</Label>
          <Textarea
            id="condicoes"
            value={condicoesEntrada}
            onChange={(e) => setCondicoesEntrada(e.target.value)}
            placeholder="Ex: Favorito jogando em casa, mercado equilibrado..."
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            {editingEstrategia ? 'Atualizar' : 'Salvar'} Estratégia
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
};
