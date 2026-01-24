import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Play, Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  goalSoundOptions,
  GoalSoundOption,
  getSelectedGoalSound,
  setSelectedGoalSound,
  playGoalSound,
} from '@/utils/soundManager';

export const GoalSoundSelector = () => {
  const [selectedSound, setSelectedSoundState] = useState<GoalSoundOption>(getSelectedGoalSound());
  const [playing, setPlaying] = useState<GoalSoundOption | null>(null);

  const handleSelectSound = (soundId: GoalSoundOption) => {
    setSelectedSoundState(soundId);
    setSelectedGoalSound(soundId);
  };

  const handlePlaySound = (soundId: GoalSoundOption) => {
    setPlaying(soundId);
    playGoalSound(soundId);
    // Reset playing state after sound duration
    setTimeout(() => setPlaying(null), 3000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          Som de Gol
        </CardTitle>
        <CardDescription>
          Escolha o som de comemoração quando houver gol nos seus jogos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <RadioGroup 
          value={selectedSound} 
          onValueChange={(value) => handleSelectSound(value as GoalSoundOption)}
        >
          {goalSoundOptions.map((option) => {
            const isPlaying = playing === option.id;
            const isSelected = selectedSound === option.id;

            return (
              <div
                key={option.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                  isSelected 
                    ? "border-primary bg-primary/5" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
                onClick={() => handleSelectSound(option.id)}
              >
                <RadioGroupItem value={option.id} id={option.id} />
                
                <div className="flex-1 min-w-0">
                  <Label 
                    htmlFor={option.id} 
                    className="font-medium cursor-pointer flex items-center gap-2"
                  >
                    {option.name}
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </Label>
                  <p className="text-sm text-muted-foreground truncate">
                    {option.description}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlaySound(option.id);
                  }}
                  disabled={isPlaying}
                  className="h-8 w-8 p-0"
                >
                  <Play className={cn("h-4 w-4", isPlaying && "animate-pulse")} />
                </Button>
              </div>
            );
          })}
        </RadioGroup>

        <p className="text-xs text-muted-foreground pt-2">
          💡 <strong>Dica:</strong> Clique no botão ▶ para ouvir o som antes de selecionar.
        </p>
      </CardContent>
    </Card>
  );
};
