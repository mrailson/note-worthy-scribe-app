// PCM16 Audio Processing for Amazon Transcribe
export async function createPcmStream(
  onPcmChunk: (buf: ArrayBuffer) => void,
  externalStream?: MediaStream
) {
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
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
    sampleRate: 16000 
  });
  
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0); // Float32Array [-1..1]
    
    // Convert Float32 to Int16 Little Endian PCM
    const pcmBuffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(pcmBuffer);
    
    for (let i = 0; i < input.length; i++) {
      // Clamp the input to [-1, 1] range
      let sample = Math.max(-1, Math.min(1, input[i]));
      
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
      stream.getTracks().forEach(track => track.stop());
      audioContext.close();
    }
  };
}