/**
 * Generates pleasant notification sounds using Web Audio API
 * These are used as fallback when MP3 files fail to load or as primary sounds
 */

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
  }
  return audioContext;
};

/**
 * Plays a soft "ding" sound for success notifications
 */
export const playSuccessSound = (volume = 0.4): void => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Create a pleasant bell-like tone
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1); // E6
    
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (e) {
    console.warn('Could not play success sound:', e);
  }
};

/**
 * Plays a gentle "boop" sound for info notifications
 */
export const playInfoSound = (volume = 0.35): void => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587, now); // D5
    osc.frequency.exponentialRampToValueAtTime(784, now + 0.15); // G5
    
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.warn('Could not play info sound:', e);
  }
};

/**
 * Plays a soft two-tone "attention" sound for warnings
 */
export const playWarningSound = (volume = 0.35): void => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // First tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523, now); // C5
    
    gain1.gain.setValueAtTime(volume, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.2);
    
    // Second tone (lower)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, now + 0.15); // A4
    
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(volume, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.start(now + 0.15);
    osc2.stop(now + 0.4);
  } catch (e) {
    console.warn('Could not play warning sound:', e);
  }
};

/**
 * Plays a soft descending tone for error notifications
 */
export const playErrorSound = (volume = 0.3): void => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(392, now); // G4
    osc.frequency.exponentialRampToValueAtTime(262, now + 0.3); // C4
    
    gainNode.gain.setValueAtTime(volume, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {
    console.warn('Could not play error sound:', e);
  }
};

export const generatedSounds = {
  success: playSuccessSound,
  info: playInfoSound,
  warning: playWarningSound,
  error: playErrorSound,
};
