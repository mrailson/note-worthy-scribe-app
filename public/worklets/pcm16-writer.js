// /public/worklets/pcm16-writer.js
// AudioWorklet processor to replace deprecated ScriptProcessorNode
class PCM16Writer extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0][0]; // Float32Array
    if (!input) return true;
    
    // Convert Float32 to Int16 PCM
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    
    // Send PCM16 data to main thread
    this.port.postMessage(out);
    return true;
  }
}

registerProcessor('pcm16-writer', PCM16Writer);