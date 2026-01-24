export type NotificationSoundType = 'success' | 'warning' | 'error' | 'info' | 'goal';

// Opções de sons de gol disponíveis
export type GoalSoundOption = 
  | 'stadium-roar' 
  | 'vuvuzela' 
  | 'whistle-cheer' 
  | 'air-horn'
  | 'epic-fanfare';

export interface GoalSoundInfo {
  id: GoalSoundOption;
  name: string;
  description: string;
  prompt: string; // Prompt para gerar via ElevenLabs
}

export const goalSoundOptions: GoalSoundInfo[] = [
  { 
    id: 'stadium-roar', 
    name: 'Estádio Lotado', 
    description: 'Torcida explodindo de alegria',
    prompt: 'Football stadium crowd exploding in celebration after a goal, loud cheering and roaring, epic atmosphere'
  },
  { 
    id: 'vuvuzela', 
    name: 'Vuvuzela Party', 
    description: 'Estilo Copa do Mundo',
    prompt: 'Vuvuzela horns blowing with excited crowd cheering, World Cup football celebration atmosphere'
  },
  { 
    id: 'whistle-cheer', 
    name: 'Apito + Torcida', 
    description: 'Árbitro + comemoração',
    prompt: 'Football referee whistle blow followed by massive crowd cheering and celebration'
  },
  { 
    id: 'air-horn', 
    name: 'Buzina de Estádio', 
    description: 'Buzinão épico + torcida',
    prompt: 'Stadium air horn blast followed by loud crowd celebration and cheering, football goal moment'
  },
  { 
    id: 'epic-fanfare', 
    name: 'Fanfarra Épica', 
    description: 'Trompetes + celebração',
    prompt: 'Epic triumphant brass fanfare with stadium crowd going wild, victory celebration'
  },
];

const notificationSoundMap: Record<Exclude<NotificationSoundType, 'goal'>, string> = {
  success: '/sounds/notification-success.mp3',
  warning: '/sounds/notification-warning.mp3',
  error: '/sounds/notification-error.mp3',
  info: '/sounds/notification-info.mp3',
};

// Armazena os sons de gol gerados em cache (base64 -> blob URL)
const goalSoundCache = new Map<GoalSoundOption, string>();

// Obtém o som de gol selecionado do localStorage
export const getSelectedGoalSound = (): GoalSoundOption => {
  const saved = localStorage.getItem('selectedGoalSound') as GoalSoundOption;
  return saved && goalSoundOptions.some(o => o.id === saved) ? saved : 'stadium-roar';
};

// Salva o som de gol selecionado
export const setSelectedGoalSound = (soundId: GoalSoundOption): void => {
  localStorage.setItem('selectedGoalSound', soundId);
};

// Verifica se o som já foi gerado e está em cache
export const isGoalSoundCached = (soundId: GoalSoundOption): boolean => {
  const cacheKey = `goalSound_${soundId}`;
  return localStorage.getItem(cacheKey) !== null || goalSoundCache.has(soundId);
};

// Salva som gerado no localStorage (base64)
export const cacheGoalSound = (soundId: GoalSoundOption, base64Audio: string): void => {
  const cacheKey = `goalSound_${soundId}`;
  try {
    localStorage.setItem(cacheKey, base64Audio);
  } catch (e) {
    console.warn('Could not cache sound in localStorage:', e);
  }
};

// Obtém som do cache (localStorage ou memory)
export const getCachedGoalSound = (soundId: GoalSoundOption): string | null => {
  // Primeiro tenta do memory cache
  if (goalSoundCache.has(soundId)) {
    return goalSoundCache.get(soundId)!;
  }
  
  // Depois tenta do localStorage
  const cacheKey = `goalSound_${soundId}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    // Cria blob URL e salva no memory cache
    const blobUrl = `data:audio/mpeg;base64,${cached}`;
    goalSoundCache.set(soundId, blobUrl);
    return blobUrl;
  }
  
  return null;
};

export const playNotificationSound = (
  type: NotificationSoundType,
  enabled: boolean
): void => {
  if (!enabled) return;

  try {
    if (type === 'goal') {
      playGoalSound();
      return;
    }
    
    const audio = new Audio(notificationSoundMap[type]);
    audio.volume = 0.5;
    audio.play().catch((err) => {
      console.warn('Could not play notification sound:', err);
    });
  } catch (error) {
    console.warn('Error creating audio element:', error);
  }
};

export const testSound = (type: NotificationSoundType): void => {
  playNotificationSound(type, true);
};

// Função para tocar som de gol (usa cache ou fallback)
export const playGoalSound = (soundId?: GoalSoundOption): void => {
  const selected = soundId || getSelectedGoalSound();
  
  try {
    // Tenta usar som em cache
    const cachedUrl = getCachedGoalSound(selected);
    if (cachedUrl) {
      const audio = new Audio(cachedUrl);
      audio.volume = 0.8;
      audio.play().catch((err) => {
        console.warn('Could not play cached goal sound:', err);
        // Fallback para o arquivo original
        playFallbackGoalSound();
      });
      return;
    }
    
    // Se não tem cache, usa o arquivo original
    playFallbackGoalSound();
  } catch (error) {
    console.warn('Error playing goal sound:', error);
    playFallbackGoalSound();
  }
};

// Fallback para o som original
const playFallbackGoalSound = (): void => {
  try {
    const audio = new Audio('/sounds/goal-celebration.mp3');
    audio.volume = 0.8;
    audio.play().catch((err) => {
      console.warn('Could not play fallback goal sound:', err);
    });
  } catch (error) {
    console.warn('Error creating fallback audio element:', error);
  }
};

// Preview de um som específico (gera se necessário)
export const previewGoalSound = async (soundId: GoalSoundOption): Promise<void> => {
  const cachedUrl = getCachedGoalSound(soundId);
  if (cachedUrl) {
    const audio = new Audio(cachedUrl);
    audio.volume = 0.8;
    await audio.play();
    return;
  }
  
  // Se não tem cache, toca o fallback
  playFallbackGoalSound();
};
