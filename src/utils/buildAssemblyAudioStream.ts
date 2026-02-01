/**
 * Builds a mixed audio stream for AssemblyAI transcription.
 * 
 * This utility uses the same approach as Whisper for system audio capture:
 * - Creates MediaStreamSource directly from the original display stream (not rewrapped tracks)
 * - Mixes mic and system audio using Web Audio API
 * - Returns a single mixed audio track via MediaStreamDestination
 * 
 * This avoids Chrome's "rewrapped track" issues that cause system audio to be silent.
 * 
 * LATENCY FIX: Can accept an existing microphone stream to avoid duplicate getUserMedia() calls.
 * SAMPLE RATE: Uses browser's default sample rate - AssemblyRealtimeClient handles resampling to 16kHz.
 */

export interface BuildAssemblyAudioStreamResult {
  mixedStream: MediaStream;
  micStream: MediaStream | null;
  audioContext: AudioContext;
  hasSystemAudio: boolean;
  /** Reason why system audio is not available (if hasSystemAudio is false) */
  systemAudioReason?: 'no_screen_stream' | 'no_audio_tracks' | 'tracks_not_live' | 'available';
  /** Cleanup function to remove event listeners */
  cleanup?: () => void;
}

export interface BuildAssemblyAudioStreamOptions {
  /** Existing microphone stream to reuse (avoids duplicate getUserMedia calls) */
  existingMicStream?: MediaStream | null;
  /** Microphone constraints (used only if existingMicStream is not provided) */
  micConstraints?: MediaTrackConstraints;
  /** Callback when system audio track ends or becomes unavailable */
  onSystemAudioLost?: () => void;
  /** Callback when system audio is detected as silent for extended period */
  onSystemAudioSilent?: () => void;
}

/**
 * Build a mixed audio stream for AssemblyAI.
 * 
 * @param screenStream - The original display stream from getDisplayMedia (may be null)
 * @param options - Options including existingMicStream and micConstraints
 * @returns Mixed stream, mic stream (for cleanup), audio context, and whether system audio was included
 */
export async function buildAssemblyAudioStream(
  screenStream: MediaStream | null | undefined,
  options: BuildAssemblyAudioStreamOptions = {}
): Promise<BuildAssemblyAudioStreamResult> {
  const startTime = performance.now();
  console.log('🎛️ buildAssemblyAudioStream: Starting...');
  
  const {
    existingMicStream,
    micConstraints = { 
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    onSystemAudioLost,
    onSystemAudioSilent
  } = options;
  
  // Detailed system audio detection
  let systemAudioReason: BuildAssemblyAudioStreamResult['systemAudioReason'] = 'available';
  let hasSystemAudio = false;
  
  if (!screenStream) {
    systemAudioReason = 'no_screen_stream';
    console.log('🎛️ buildAssemblyAudioStream: No screen stream provided');
  } else {
    const systemAudioTracks = screenStream.getAudioTracks();
    console.log(`🎛️ buildAssemblyAudioStream: Screen stream has ${systemAudioTracks.length} audio track(s)`);
    
    if (systemAudioTracks.length === 0) {
      systemAudioReason = 'no_audio_tracks';
      console.log('🎛️ buildAssemblyAudioStream: No audio tracks in screen stream');
    } else {
      // Log detailed track info
      for (const track of systemAudioTracks) {
        const settings = track.getSettings?.() || {};
        console.log('🎛️ buildAssemblyAudioStream: System audio track:', {
          id: track.id,
          label: track.label,
          enabled: track.enabled,
          muted: (track as any).muted,
          readyState: track.readyState,
          settings
        });
      }
      
      // Check if any tracks are live
      const liveTrackCount = systemAudioTracks.filter(t => t.readyState === 'live' && t.enabled).length;
      if (liveTrackCount === 0) {
        systemAudioReason = 'tracks_not_live';
        console.log('🎛️ buildAssemblyAudioStream: No live/enabled audio tracks');
      } else {
        hasSystemAudio = true;
        systemAudioReason = 'available';
        console.log(`🎛️ buildAssemblyAudioStream: ${liveTrackCount} live audio track(s) available`);
      }
    }
  }
  
  // Use existing mic stream if provided, otherwise request a new one
  let micStream: MediaStream | null = null;
  let ownsMicStream = false;
  
  if (existingMicStream && existingMicStream.getAudioTracks().some(t => t.readyState === 'live')) {
    micStream = existingMicStream;
    ownsMicStream = false;
    console.log(`🎙️ buildAssemblyAudioStream: Reusing existing mic stream (${micStream.getAudioTracks().length} tracks) - FAST PATH`);
  } else {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraints });
      ownsMicStream = true;
      console.log(`🎙️ buildAssemblyAudioStream: Got NEW mic stream with ${micStream.getAudioTracks().length} tracks`);
    } catch (err) {
      console.error('🎙️ buildAssemblyAudioStream: Failed to get mic stream:', err);
      throw err;
    }
  }
  
  const micSetupTime = performance.now() - startTime;
  console.log(`🎛️ buildAssemblyAudioStream: Mic setup took ${micSetupTime.toFixed(0)}ms`);
  
  // If no system audio, just return the mic stream directly (fast path)
  if (!hasSystemAudio || !screenStream) {
    console.log(`🎛️ buildAssemblyAudioStream: No system audio (reason: ${systemAudioReason}), returning mic-only stream`);
    
    // Create a minimal audio context using browser's default sample rate
    // AssemblyRealtimeClient handles resampling to 16kHz internally
    const audioContext = new AudioContext();
    
    const totalTime = performance.now() - startTime;
    console.log(`🎛️ buildAssemblyAudioStream: Completed in ${totalTime.toFixed(0)}ms (mic-only)`);
    
    return {
      mixedStream: micStream,
      micStream: ownsMicStream ? micStream : null, // Only return for cleanup if we created it
      audioContext,
      hasSystemAudio: false,
      systemAudioReason
    };
  }
  
  // --- Mix system audio + mic using Web Audio (same approach as Whisper) ---
  console.log('🎛️ buildAssemblyAudioStream: Creating Web Audio mixer...');
  
  // Use browser's default sample rate (typically 48kHz)
  // AssemblyRealtimeClient handles resampling to 16kHz internally
  const audioContext = new AudioContext();
  console.log(`🎛️ buildAssemblyAudioStream: AudioContext created at ${audioContext.sampleRate}Hz`);
  
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

  // Keep AudioContext processing alive even if nothing is routed to speakers.
  // Some browsers can produce a silent MediaStreamDestination unless there is
  // also a (muted) connection to the real output.
  const keepAliveGain = audioContext.createGain();
  keepAliveGain.gain.value = 0;
  compressor.connect(keepAliveGain);
  keepAliveGain.connect(audioContext.destination);
  
  // Log track info for debugging
  const outputTracks = destination.stream.getAudioTracks();
  console.log(`🎛️ buildAssemblyAudioStream: Mixed stream created with ${outputTracks.length} track(s)`);
  for (const track of outputTracks) {
    console.log(`🎛️ buildAssemblyAudioStream: Output track: ${track.label}, enabled: ${track.enabled}, readyState: ${track.readyState}`);
  }

  // === SYSTEM AUDIO TRACK MONITORING ===
  // Listen for track ended/muted events to detect when system audio becomes unavailable
  const systemAudioTracks = screenStream.getAudioTracks();
  const cleanupListeners: (() => void)[] = [];
  let systemAudioLostNotified = false;
  let silenceStartTime: number | null = null;
  const SILENCE_THRESHOLD_MS = 60000; // 60 seconds of silence triggers warning

  for (const track of systemAudioTracks) {
    const handleEnded = () => {
      console.warn('🔇 buildAssemblyAudioStream: System audio track ENDED');
      if (!systemAudioLostNotified && onSystemAudioLost) {
        systemAudioLostNotified = true;
        onSystemAudioLost();
      }
    };

    const handleMute = () => {
      console.warn('🔇 buildAssemblyAudioStream: System audio track MUTED');
      if (!systemAudioLostNotified && onSystemAudioLost) {
        systemAudioLostNotified = true;
        onSystemAudioLost();
      }
    };

    track.addEventListener('ended', handleEnded);
    track.addEventListener('mute', handleMute);
    
    cleanupListeners.push(() => {
      track.removeEventListener('ended', handleEnded);
      track.removeEventListener('mute', handleMute);
    });
  }
  
  // Add RMS monitoring for both system and mixed paths
  const systemAnalyser = audioContext.createAnalyser();
  systemAnalyser.fftSize = 256;
  systemGain.connect(systemAnalyser);
  
  const mixedAnalyser = audioContext.createAnalyser();
  mixedAnalyser.fftSize = 256;
  compressor.connect(mixedAnalyser);
  
  let lastRMSLog = 0;
  let systemAudioDetectedEver = false;
  const systemDataArray = new Uint8Array(systemAnalyser.frequencyBinCount);
  const mixedDataArray = new Uint8Array(mixedAnalyser.frequencyBinCount);
  let rmsCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const checkRMS = () => {
    if (audioContext.state === 'closed') return;
    
    // Check system audio path
    systemAnalyser.getByteTimeDomainData(systemDataArray);
    let systemSum = 0;
    for (let i = 0; i < systemDataArray.length; i++) {
      const normalized = (systemDataArray[i] - 128) / 128;
      systemSum += normalized * normalized;
    }
    const systemRms = Math.sqrt(systemSum / systemDataArray.length);
    
    // Check mixed output
    mixedAnalyser.getByteTimeDomainData(mixedDataArray);
    let mixedSum = 0;
    for (let i = 0; i < mixedDataArray.length; i++) {
      const normalized = (mixedDataArray[i] - 128) / 128;
      mixedSum += normalized * normalized;
    }
    const mixedRms = Math.sqrt(mixedSum / mixedDataArray.length);
    
    // Track if we've ever detected system audio
    if (systemRms > 0.01) {
      systemAudioDetectedEver = true;
      silenceStartTime = null; // Reset silence tracking
    } else if (systemAudioDetectedEver) {
      // System audio was active before but is now silent
      if (silenceStartTime === null) {
        silenceStartTime = Date.now();
      } else if (Date.now() - silenceStartTime >= SILENCE_THRESHOLD_MS) {
        // Extended silence detected
        if (!systemAudioLostNotified && onSystemAudioSilent) {
          console.warn('🔇 buildAssemblyAudioStream: Extended system audio silence detected (60s+)');
          onSystemAudioSilent();
          // Don't set systemAudioLostNotified - silence is recoverable
        }
      }
    }
    
    const now = Date.now();
    if (now - lastRMSLog > 3000) {
      lastRMSLog = now;
      const systemStatus = systemRms > 0.01 ? '🔊 ACTIVE' : systemAudioDetectedEver ? '🔇 quiet' : '⚠️ SILENT';
      const mixedStatus = mixedRms > 0.01 ? '🔊 ACTIVE' : '🔇 quiet';
      console.log(`🎛️ buildAssemblyAudioStream RMS: system=${systemRms.toFixed(4)} (${systemStatus}), mixed=${mixedRms.toFixed(4)} (${mixedStatus})`);
    }
    
    if (audioContext.state === 'running') {
      rmsCheckTimeout = setTimeout(checkRMS, 500);
    }
  };
  
  // Start RMS monitoring after a short delay
  setTimeout(checkRMS, 1000);

  // Cleanup function to remove all event listeners
  const cleanup = () => {
    console.log('🎛️ buildAssemblyAudioStream: Running cleanup listeners');
    cleanupListeners.forEach(fn => fn());
    if (rmsCheckTimeout) {
      clearTimeout(rmsCheckTimeout);
    }

    try {
      keepAliveGain.disconnect();
    } catch {
      // ignore
    }
  };
  
  const totalTime = performance.now() - startTime;
  console.log(`🎛️ buildAssemblyAudioStream: Completed in ${totalTime.toFixed(0)}ms (mixed stream)`);
  
  return {
    mixedStream: destination.stream,
    micStream: ownsMicStream ? micStream : null, // Only return for cleanup if we created it
    audioContext,
    hasSystemAudio: true,
    systemAudioReason: 'available',
    cleanup
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

  // Run custom cleanup (event listeners, RMS timers)
  try {
    result.cleanup?.();
  } catch (err) {
    console.warn('🎛️ cleanupAssemblyAudioStream: Error running cleanup callback:', err);
  }
  
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
