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

const notificationSoundMap: Record<Exclude<NotificationSoundType, 'goal' | 'error'>, string> = {
  success: '/sounds/notification-success.mp3',
  warning: '/sounds/notification-warning.mp3',
  info: '/sounds/notification-info.mp3',
};

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
    
    // Use generated soft sound only for error (the old one sounds like computer error)
    if (type === 'error') {
      generatedSounds.error();
      return;
    }
    
    // Use original MP3 files for success, warning, info
    const audio = new Audio(notificationSoundMap[type as keyof typeof notificationSoundMap]);
    audio.volume = 0.5;
    audio.play().catch((err) => {
      console.warn('Could not play notification sound:', err);
    });
  } catch (error) {
    console.warn('Error playing notification sound:', error);
  }
};

export const testSound = (type: NotificationSoundType): void => {
  playNotificationSound(type, true);
};

// Debounce para evitar som duplicado
let lastGoalSoundTime = 0;
const GOAL_SOUND_DEBOUNCE = 15000; // 15 segundos

// Função para tocar som de gol (com debounce)
export const playGoalSound = (soundId?: GoalSoundOption): void => {
  const now = Date.now();
  if (now - lastGoalSoundTime < GOAL_SOUND_DEBOUNCE) {
    console.log('[SoundManager] Debouncing goal sound (too soon)');
    return;
  }
  lastGoalSoundTime = now;
  
  try {
    const path = getGoalSoundPath(soundId);
    console.log('[SoundManager] Playing goal sound:', path);
    const audio = new Audio(path);
    audio.volume = 0.8;
    audio.play().catch((err) => {
      console.warn('Could not play goal sound:', err);
    });
  } catch (error) {
    console.warn('Error playing goal sound:', error);
  }
};

// Preview de um som específico (sem debounce para testes)
export const previewGoalSound = (soundId: GoalSoundOption): void => {
  try {
    const option = goalSoundOptions.find(o => o.id === soundId);
    const path = option?.path || '/sounds/goal-celebration.mp3';
    const audio = new Audio(path);
    audio.volume = 0.8;
    audio.play().catch((err) => {
      console.warn('Could not preview goal sound:', err);
    });
  } catch (error) {
    console.warn('Error previewing goal sound:', error);
  }
};

// === Web Speech API - Voz "Jogo começando agora!" ===
let lastVoiceTime = 0;
const VOICE_DEBOUNCE = 30000; // 30s

export const playGameStartVoice = (): void => {
  if (!('speechSynthesis' in window)) {
    console.warn('[SoundManager] SpeechSynthesis not supported');
    return;
  }

  const now = Date.now();
  if (now - lastVoiceTime < VOICE_DEBOUNCE) {
    console.log('[SoundManager] Debouncing voice (too soon)');
    return;
  }
  lastVoiceTime = now;

  try {
    window.speechSynthesis.cancel(); // Cancel any pending speech
    const utterance = new SpeechSynthesisUtterance('Jogo começando agora!');
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.volume = 1.0;

    // Try to find a pt-BR voice
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    console.log('[SoundManager] Speaking: "Jogo começando agora!"');
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('[SoundManager] Error with speech synthesis:', error);
  }
};

// Preview voice without debounce (for testing)
export const testGameStartVoice = (): void => {
  if (!('speechSynthesis' in window)) {
    console.warn('[SoundManager] SpeechSynthesis not supported');
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Jogo começando agora!');
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('[SoundManager] Error testing voice:', error);
  }
};

// === Red Card Voice Alert ===
let lastRedCardVoiceTime = 0;
const RED_CARD_VOICE_DEBOUNCE = 30000; // 30s

export const playRedCardVoice = (): void => {
  if (!('speechSynthesis' in window)) {
    console.warn('[SoundManager] SpeechSynthesis not supported');
    return;
  }

  const now = Date.now();
  if (now - lastRedCardVoiceTime < RED_CARD_VOICE_DEBOUNCE) {
    console.log('[SoundManager] Debouncing red card voice (too soon)');
    return;
  }
  lastRedCardVoiceTime = now;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Cartão vermelho!');
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    console.log('[SoundManager] Speaking: "Cartão vermelho!"');
    window.speechSynthesis.speak(utterance);
  } catch (error) {
    console.warn('[SoundManager] Error with red card speech:', error);
  }
};
