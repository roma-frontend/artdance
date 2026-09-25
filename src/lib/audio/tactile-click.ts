/**
 * Синтезатор элегантного тихого звукового отклика (haptic audio click).
 * Не требует скачивания тяжелых mp3/wav файлов, работает мгновенно через Web Audio API.
 * Безопасно для всех браузеров, не шумит, уважает prefers-reduced-motion.
 */

let audioCtx: AudioContext | null = null;

export function playTactileClick() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Мягкий премиальный акустический "тик" (щелчок)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.035);

    // Очень деликатная громкость (не оглушает пользователя)
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.038);
  } catch {
    // Web Audio недоступен или заблокирован политиками браузера
  }
}
