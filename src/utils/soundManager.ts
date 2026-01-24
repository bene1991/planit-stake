import { generatedSounds } from './generateNotificationSounds';

export type NotificationSoundType = 'success' | 'warning' | 'error' | 'info' | 'goal';

// Opções de sons de gol disponíveis (arquivos locais)
export type GoalSoundOption = 
  | 'celebration' 
  | 'air-horn' 
  | 'epic-fanfare' 
  | 'whistle-cheer';

export interface GoalSoundInfo {
  id: GoalSoundOption;
  name: string;
  description: string;
  path: string;
}

export const goalSoundOptions: GoalSoundInfo[] = [
  { 
    id: 'celebration', 
    name: 'Comemoração Original', 
    description: 'Torcida celebrando',
    path: '/sounds/goal-celebration.mp3'
  },
  { 
    id: 'air-horn', 
    name: 'Buzina de Estádio', 
    description: 'Buzinão épico',
    path: '/sounds/goal-air-horn.mp3'
  },
  { 
    id: 'epic-fanfare', 
    name: 'Fanfarra Épica', 
    description: 'Trompetes vitoriosos',
    path: '/sounds/goal-epic-fanfare.mp3'
  },
  { 
    id: 'whistle-cheer', 
    name: 'Apito + Torcida', 
    description: 'Árbitro + comemoração',
    path: '/sounds/goal-whistle-cheer.mp3'
  },
];

// Use Web Audio API generated sounds for notifications (softer, more pleasant)
const useGeneratedSounds = true;

// Obtém o som de gol selecionado do localStorage
export const getSelectedGoalSound = (): GoalSoundOption => {
  const saved = localStorage.getItem('selectedGoalSound') as GoalSoundOption;
  return saved && goalSoundOptions.some(o => o.id === saved) ? saved : 'celebration';
};

// Salva o som de gol selecionado
export const setSelectedGoalSound = (soundId: GoalSoundOption): void => {
  localStorage.setItem('selectedGoalSound', soundId);
};

// Obtém o path do som selecionado
const getGoalSoundPath = (soundId?: GoalSoundOption): string => {
  const selected = soundId || getSelectedGoalSound();
  const option = goalSoundOptions.find(o => o.id === selected);
  return option?.path || '/sounds/goal-celebration.mp3';
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
    
    // Use Web Audio API generated sounds (softer, more pleasant)
    if (useGeneratedSounds && type in generatedSounds) {
      generatedSounds[type as keyof typeof generatedSounds]();
      return;
    }
  } catch (error) {
    console.warn('Error playing notification sound:', error);
  }
};

export const testSound = (type: NotificationSoundType): void => {
  playNotificationSound(type, true);
};

// Função para tocar som de gol
export const playGoalSound = (soundId?: GoalSoundOption): void => {
  try {
    const path = getGoalSoundPath(soundId);
    const audio = new Audio(path);
    audio.volume = 0.8;
    audio.play().catch((err) => {
      console.warn('Could not play goal sound:', err);
    });
  } catch (error) {
    console.warn('Error playing goal sound:', error);
  }
};

// Preview de um som específico
export const previewGoalSound = (soundId: GoalSoundOption): void => {
  playGoalSound(soundId);
};
