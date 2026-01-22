/**
 * Builds a mixed audio stream for AssemblyAI transcription.
 * 
 * This utility uses the same approach as Whisper for system audio capture:
 * - Creates MediaStreamSource directly from the original display stream (not rewrapped tracks)
 * - Mixes mic and system audio using Web Audio API
 * - Returns a single mixed audio track via MediaStreamDestination
 * 
 * This avoids Chrome's "rewrapped track" issues that cause system audio to be silent.
 */

export interface BuildAssemblyAudioStreamResult {
  mixedStream: MediaStream;
  micStream: MediaStream | null;
  audioContext: AudioContext;
  hasSystemAudio: boolean;
}

/**
 * Build a mixed audio stream for AssemblyAI.
 * 
 * @param screenStream - The original display stream from getDisplayMedia (may be null)
 * @param micConstraints - Microphone constraints (defaults to basic audio)
 * @returns Mixed stream, mic stream (for cleanup), audio context, and whether system audio was included
 */
export async function buildAssemblyAudioStream(
  screenStream: MediaStream | null | undefined,
  micConstraints: MediaTrackConstraints = { 
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
): Promise<BuildAssemblyAudioStreamResult> {
  console.log('🎛️ buildAssemblyAudioStream: Starting...');
  
  // Check if we have system audio from the screen stream
  const systemAudioTracks = screenStream?.getAudioTracks() ?? [];
  const hasSystemAudio = systemAudioTracks.length > 0 && systemAudioTracks.some(t => t.readyState === 'live');
  
  console.log(`🎛️ buildAssemblyAudioStream: System audio tracks: ${systemAudioTracks.length}, live: ${hasSystemAudio}`);
  
  // Always get mic stream
  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints });
    console.log(`🎙️ buildAssemblyAudioStream: Got mic stream with ${micStream.getAudioTracks().length} tracks`);
  } catch (err) {
    console.error('🎙️ buildAssemblyAudioStream: Failed to get mic stream:', err);
    throw err;
  }
  
  // If no system audio, just return the mic stream directly
  if (!hasSystemAudio || !screenStream) {
    console.log('🎛️ buildAssemblyAudioStream: No system audio, returning mic-only stream');
    
    // Create a minimal audio context just for consistency
    const audioContext = new AudioContext();
    
    return {
      mixedStream: micStream,
      micStream,
      audioContext,
      hasSystemAudio: false
    };
  }
  
  // --- Mix system audio + mic using Web Audio (same approach as Whisper) ---
  console.log('🎛️ buildAssemblyAudioStream: Creating Web Audio mixer...');
  
  const audioContext = new AudioContext({ sampleRate: 48000 });
  
  // Resume context in case it's suspended (Chrome policy)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
    console.log('🎛️ buildAssemblyAudioStream: AudioContext resumed');
  }
  
  // Create source from the ORIGINAL display stream (not rewrapped tracks!)
  // This is the key difference vs the broken approach
  const systemSource = audioContext.createMediaStreamSource(screenStream);
  const micSource = audioContext.createMediaStreamSource(micStream);
  
  // Create gain nodes for level control
  const systemGain = audioContext.createGain();
  systemGain.gain.value = 2.0; // Boost system audio (same as Whisper)
  
  const micGain = audioContext.createGain();
  micGain.gain.value = 1.0;
  
  // Optional: Add compressor to prevent clipping
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  
  // Create destination for the mixed output
  const destination = audioContext.createMediaStreamDestination();
  
  // Connect the audio graph:
  // systemSource -> systemGain -> compressor -> destination
  // micSource -> micGain -> compressor -> destination
  systemSource.connect(systemGain);
  systemGain.connect(compressor);
  
  micSource.connect(micGain);
  micGain.connect(compressor);
  
  compressor.connect(destination);
  
  // Log track info for debugging
  const outputTracks = destination.stream.getAudioTracks();
  console.log(`🎛️ buildAssemblyAudioStream: Mixed stream created with ${outputTracks.length} track(s)`);
  for (const track of outputTracks) {
    console.log(`🎛️ buildAssemblyAudioStream: Output track: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
  }
  
  // Add RMS monitoring for debugging (log once every 2 seconds)
  let lastRMSLog = 0;
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  compressor.connect(analyser);
  
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const checkRMS = () => {
    if (audioContext.state === 'closed') return;
    
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    
    const now = Date.now();
    if (now - lastRMSLog > 2000 && rms > 0.001) {
      lastRMSLog = now;
      console.log(`🎛️ buildAssemblyAudioStream: Mixed audio RMS: ${rms.toFixed(4)} (${rms > 0.01 ? '🔊 audio detected' : '🔇 quiet'})`);
    }
    
    if (audioContext.state === 'running') {
      setTimeout(checkRMS, 500);
    }
  };
  // Start RMS monitoring after a short delay
  setTimeout(checkRMS, 1000);
  
  return {
    mixedStream: destination.stream,
    micStream,
    audioContext,
    hasSystemAudio: true
  };
}

/**
 * Cleanup resources from buildAssemblyAudioStream.
 */
export function cleanupAssemblyAudioStream(
  result: BuildAssemblyAudioStreamResult | null
): void {
  if (!result) return;
  
  console.log('🎛️ cleanupAssemblyAudioStream: Cleaning up...');
  
  // Stop mic stream tracks (these are ours to manage)
  try {
    result.micStream?.getTracks().forEach(t => t.stop());
  } catch (err) {
    console.warn('🎛️ cleanupAssemblyAudioStream: Error stopping mic stream:', err);
  }
  
  // Close audio context
  try {
    if (result.audioContext.state !== 'closed') {
      result.audioContext.close();
    }
  } catch (err) {
    console.warn('🎛️ cleanupAssemblyAudioStream: Error closing audio context:', err);
  }
  
  console.log('🎛️ cleanupAssemblyAudioStream: Cleanup complete');
}
