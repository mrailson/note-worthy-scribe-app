// /public/worklets/pcm16-writer.js
// AudioWorklet processor: converts Float32 audio to Int16 PCM
// Includes linear-interpolation resampling from source rate → 16 kHz
class PCM16Writer extends AudioWorkletProcessor {
  constructor() {
    super();
    this._resamplePos = 0;
  }

  process(inputs) {
    const input = inputs[0][0]; // mono Float32Array
    if (!input || input.length === 0) return true;

    const srcRate = sampleRate; // AudioWorklet global — actual context rate
    const tgtRate = 16000;

    let samples;
    if (srcRate === tgtRate) {
      samples = input;
    } else {
      // Linear-interpolation resample
      const ratio = srcRate / tgtRate;
      const outLen = Math.floor(input.length / ratio);
      samples = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const srcIdx = i * ratio + this._resamplePos;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, input.length - 1);
        const frac = srcIdx - idx0;
        if (idx0 < input.length) {
          samples[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
        }
      }
      // Track fractional position across blocks for seamless resampling
      this._resamplePos = ((input.length / ratio) % 1) * ratio;
    }

    // Float32 → Int16 PCM
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Transfer ownership for zero-copy
    this.port.postMessage(out.buffer, [out.buffer]);
    return true;
  }
}

registerProcessor('pcm16-writer', PCM16Writer);
