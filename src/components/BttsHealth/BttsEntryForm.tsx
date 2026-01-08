import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getOddZone, BttsEntry } from '@/types/btts';
import { cn } from '@/lib/utils';
import { Plus, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface BttsEntryFormProps {
  onSubmit: (entry: Omit<BttsEntry, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'profit'>) => Promise<BttsEntry | null>;
}

export function BttsEntryForm({ onSubmit }: BttsEntryFormProps) {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [league, setLeague] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [odd, setOdd] = useState('');
  const [stakeValue, setStakeValue] = useState('');
  const [result, setResult] = useState<'Green' | 'Red' | 'Void' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const oddValue = parseFloat(odd) || 0;
  const oddZone = getOddZone(oddValue);

  const handleSubmit = async () => {
    if (!date || !time || !league || !homeTeam || !awayTeam || !odd || !stakeValue || !result) {
      return;
    }

    setSubmitting(true);
    const success = await onSubmit({
      date,
      time,
      league,
      home_team: homeTeam,
      away_team: awayTeam,
      odd: parseFloat(odd),
      stake_value: parseFloat(stakeValue),
      result,
      method: 'BTTS',
    });

    if (success) {
      // Reset form
      setLeague('');
      setHomeTeam('');
      setAwayTeam('');
      setOdd('');
      setResult(null);
    }
    setSubmitting(false);
  };

  const isValid = date && time && league && homeTeam && awayTeam && odd && stakeValue && result;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Plus className="h-5 w-5" />
          Nova Entrada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Hora</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Liga</Label>
          <Input
            placeholder="Ex: Premier League"
            value={league}
            onChange={(e) => setLeague(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Casa</Label>
            <Input
              placeholder="Time casa"
              value={homeTeam}
              onChange={(e) => setHomeTeam(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Visitante</Label>
            <Input
              placeholder="Time visitante"
              value={awayTeam}
              onChange={(e) => setAwayTeam(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Odd</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                placeholder="2.25"
                value={odd}
                onChange={(e) => setOdd(e.target.value)}
                className={cn(
                  "h-9 pr-8",
                  oddZone === 'blocked' && "border-destructive",
                  oddZone === 'warning' && "border-yellow-500"
                )}
              />
              {oddZone === 'blocked' && (
                <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
              )}
              {oddZone === 'warning' && (
                <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-yellow-500" />
              )}
            </div>
            {oddZone === 'blocked' && (
              <p className="text-[10px] text-destructive">Fora do playbook!</p>
            )}
            {oddZone === 'warning' && (
              <p className="text-[10px] text-yellow-500">Zona de cautela</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Stake (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="100"
              value={stakeValue}
              onChange={(e) => setStakeValue(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Resultado</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={result === 'Green' ? 'default' : 'outline'}
              className={cn(
                "flex-1 h-10",
                result === 'Green' && "bg-green-600 hover:bg-green-700"
              )}
              onClick={() => setResult('Green')}
            >
              🟢 Green
            </Button>
            <Button
              type="button"
              variant={result === 'Red' ? 'default' : 'outline'}
              className={cn(
                "flex-1 h-10",
                result === 'Red' && "bg-red-600 hover:bg-red-700"
              )}
              onClick={() => setResult('Red')}
            >
              🔴 Red
            </Button>
            <Button
              type="button"
              variant={result === 'Void' ? 'default' : 'outline'}
              className={cn(
                "flex-1 h-10",
                result === 'Void' && "bg-muted"
              )}
              onClick={() => setResult('Void')}
            >
              ⚪ Void
            </Button>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full"
        >
          {submitting ? 'Registrando...' : 'Registrar Entrada'}
        </Button>
      </CardContent>
    </Card>
  );
}
