import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Timer, Zap } from 'lucide-react';
import { useRefreshInterval, REFRESH_INTERVAL_OPTIONS, RefreshInterval } from '@/hooks/useRefreshInterval';

export function RefreshIntervalSettings() {
  const { interval, updateInterval } = useRefreshInterval();

  return (
    <Card className="p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Timer className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Intervalo de Atualização</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Escolha a frequência de atualização dos placares ao vivo. Intervalos maiores economizam créditos da API.
      </p>

      <RadioGroup 
        value={String(interval)} 
        onValueChange={(value) => updateInterval(parseInt(value, 10) as RefreshInterval)}
      >
        <div className="grid gap-3">
          {REFRESH_INTERVAL_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`interval-${option.value}`}
              className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem value={String(option.value)} id={`interval-${option.value}`} />
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {option.credits}
                  </p>
                </div>
              </div>
              {option.value === 20 && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  Padrão
                </span>
              )}
              {option.value === 120 && (
                <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                  Econômico
                </span>
              )}
            </Label>
          ))}
        </div>
      </RadioGroup>
    </Card>
  );
}
