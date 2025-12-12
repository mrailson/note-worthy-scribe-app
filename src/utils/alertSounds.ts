/**
 * Warning sound utility for LG Capture patient identity alerts
 * Uses Web Audio API to generate warning beeps without external files
 */

let beepCount = 0;

export function playWarningBeep(repeatCount = 9) {
  beepCount = 0;
  playBeep(repeatCount);
}

function playBeep(totalBeeps: number) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Warning tone: 800Hz beep
    oscillator.frequency.value = 800;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    
    beepCount++;
    
    // Repeat beeps
    if (beepCount < totalBeeps) {
      setTimeout(() => playBeep(totalBeeps), 300);
    }
  } catch (e) {
    console.warn('Could not play warning sound:', e);
  }
}
