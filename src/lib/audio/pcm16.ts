// PCM16 Audio Processing for Amazon Transcribe
export async function createPcmStream(
  onPcmChunk: (buf: ArrayBuffer) => void,
  externalStream?: MediaStream
) {
  const ownsStream = !externalStream;
  console.log('🎙️ Starting PCM16 audio stream...', externalStream ? '(using external stream)' : '(using getUserMedia)');
  
  const stream = externalStream || await navigator.mediaDevices.getUserMedia({ 
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  });

  // When using an external stream (e.g. mixed mic+system at 48kHz),
  // let the AudioContext use the stream's native sample rate to avoid
  // resampling artefacts at input. We downsample manually to 16kHz PCM.
  const nativeSampleRate = externalStream
    ? (externalStream.getAudioTracks()[0]?.getSettings?.()?.sampleRate || 48000)
    : 16000;

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
    sampleRate: nativeSampleRate 
  });

  console.log(`🎙️ PCM16: AudioContext at ${audioContext.sampleRate}Hz, target 16000Hz`);
  
  const source = audioContext.createMediaStreamSource(stream);
  const bufferSize = 4096;
  const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
  
  source.connect(processor);
  processor.connect(audioContext.destination);

  // Downsampling state (only needed when native rate ≠ 16kHz)
  const needsResample = audioContext.sampleRate !== 16000;
  const ratio = audioContext.sampleRate / 16000;

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0); // Float32Array [-1..1]

    let samples: Float32Array;
    if (needsResample) {
      // Simple linear-interpolation downsample to 16kHz
      const outputLen = Math.floor(input.length / ratio);
      samples = new Float32Array(outputLen);
      for (let i = 0; i < outputLen; i++) {
        const srcIdx = i * ratio;
        const idx = Math.floor(srcIdx);
        const frac = srcIdx - idx;
        const a = input[idx] ?? 0;
        const b = input[Math.min(idx + 1, input.length - 1)] ?? 0;
        samples[i] = a + frac * (b - a);
      }
    } else {
      samples = input;
    }
    
    // Convert Float32 to Int16 Little Endian PCM
    const pcmBuffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(pcmBuffer);
    
    for (let i = 0; i < samples.length; i++) {
      // Clamp the input to [-1, 1] range
      let sample = Math.max(-1, Math.min(1, samples[i]));
      
      // Convert to 16-bit signed integer
      const int16Sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      
      // Write as little-endian 16-bit signed integer
      view.setInt16(i * 2, int16Sample, true);
    }
    
    onPcmChunk(pcmBuffer);
  };

  return {
    stop: () => {
      console.log('🛑 Stopping PCM16 audio stream...');
      processor.disconnect();
      source.disconnect();
      // Only stop tracks we own — external streams are managed by the caller
      if (ownsStream) {
        stream.getTracks().forEach(track => track.stop());
      }
      audioContext.close();
    }
  };
}