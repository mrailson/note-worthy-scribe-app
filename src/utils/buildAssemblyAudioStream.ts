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
  /** Reason why system audio is not available (if hasSystemAudio is false) */
  systemAudioReason?: 'no_screen_stream' | 'no_audio_tracks' | 'tracks_not_live' | 'available';
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
    console.log(`🎛️ buildAssemblyAudioStream: No system audio (reason: ${systemAudioReason}), returning mic-only stream`);
    
    // Create a minimal audio context just for consistency
    const audioContext = new AudioContext();
    
    return {
      mixedStream: micStream,
      micStream,
      audioContext,
      hasSystemAudio: false,
      systemAudioReason
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
    }
    
    const now = Date.now();
    if (now - lastRMSLog > 3000) {
      lastRMSLog = now;
      const systemStatus = systemRms > 0.01 ? '🔊 ACTIVE' : systemAudioDetectedEver ? '🔇 quiet' : '⚠️ SILENT';
      const mixedStatus = mixedRms > 0.01 ? '🔊 ACTIVE' : '🔇 quiet';
      console.log(`🎛️ buildAssemblyAudioStream RMS: system=${systemRms.toFixed(4)} (${systemStatus}), mixed=${mixedRms.toFixed(4)} (${mixedStatus})`);
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
    hasSystemAudio: true,
    systemAudioReason: 'available'
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
