import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Play, Loader2, Check, Volume2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  goalSoundOptions,
  GoalSoundOption,
  getSelectedGoalSound,
  setSelectedGoalSound,
  isGoalSoundCached,
  cacheGoalSound,
} from '@/utils/soundManager';

// Fallback para som original
const playFallbackSound = () => {
  try {
    const audio = new Audio('/sounds/goal-celebration.mp3');
    audio.volume = 0.8;
    audio.play().catch(console.warn);
  } catch (e) {
    console.warn(e);
  }
};

export const GoalSoundSelector = () => {
  const [selectedSound, setSelectedSoundState] = useState<GoalSoundOption>(getSelectedGoalSound());
  const [generating, setGenerating] = useState<GoalSoundOption | null>(null);
  const [playing, setPlaying] = useState<GoalSoundOption | null>(null);
  const [cachedSounds, setCachedSounds] = useState<Set<GoalSoundOption>>(new Set());

  // Verifica quais sons já estão em cache
  useEffect(() => {
    const cached = new Set<GoalSoundOption>();
    goalSoundOptions.forEach(option => {
      if (isGoalSoundCached(option.id)) {
        cached.add(option.id);
      }
    });
    setCachedSounds(cached);
  }, []);

  const handleSelectSound = (soundId: GoalSoundOption) => {
    setSelectedSoundState(soundId);
    setSelectedGoalSound(soundId);
  };

  const generateSound = async (option: typeof goalSoundOptions[0]) => {
    setGenerating(option.id);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-sfx`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: option.prompt,
            duration: 4,
            prompt_influence: 0.4,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to generate sound: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Salva no cache
      cacheGoalSound(option.id, data.audioContent);
      setCachedSounds(prev => new Set([...prev, option.id]));
      
      // Toca o som gerado
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audio.volume = 0.8;
      
      setPlaying(option.id);
      audio.onended = () => setPlaying(null);
      await audio.play();
      
      toast.success(`Som "${option.name}" gerado com sucesso!`);
    } catch (error) {
      console.error('Error generating sound:', error);
      toast.error('Erro ao gerar som. Tente novamente.');
    } finally {
      setGenerating(null);
    }
  };

  const playSound = async (option: typeof goalSoundOptions[0]) => {
    // Se já está em cache, toca direto
    const cacheKey = `goalSound_${option.id}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        setPlaying(option.id);
        const audioUrl = `data:audio/mpeg;base64,${cached}`;
        const audio = new Audio(audioUrl);
        audio.volume = 0.8;
        audio.onended = () => setPlaying(null);
        await audio.play();
      } catch (e) {
        setPlaying(null);
        console.warn('Error playing cached sound:', e);
        playFallbackSound();
      }
      return;
    }

    // Se não está em cache, gera primeiro
    await generateSound(option);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          Som de Gol
        </CardTitle>
        <CardDescription>
          Escolha o som de comemoração quando houver gol. Clique em "Gerar" para criar sons personalizados com IA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <RadioGroup 
          value={selectedSound} 
          onValueChange={(value) => handleSelectSound(value as GoalSoundOption)}
        >
          {goalSoundOptions.map((option) => {
            const isCached = cachedSounds.has(option.id);
            const isGenerating = generating === option.id;
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

                <div className="flex items-center gap-2">
                  {isCached ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        playSound(option);
                      }}
                      disabled={isPlaying}
                      className="h-8 w-8 p-0"
                    >
                      {isPlaying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        generateSound(option);
                      }}
                      disabled={isGenerating}
                      className="h-8 gap-1"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-xs">Gerando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3" />
                          <span className="text-xs">Gerar</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </RadioGroup>

        <p className="text-xs text-muted-foreground pt-2">
          💡 <strong>Dica:</strong> Os sons são gerados por IA e ficam salvos no navegador. 
          Clique em "Gerar" para criar cada som uma vez.
        </p>
      </CardContent>
    </Card>
  );
};
