class PCM16Writer extends AudioWorkletProcessor {
  constructor() {
    super();
    this._resamplePos = 0;
  }

  process(inputs) {
    const input = inputs[0][0];
    if (!input || input.length === 0) return true;

    const srcRate = sampleRate;
    const tgtRate = 16000;

    let samples;
    if (srcRate === tgtRate) {
      samples = input;
    } else {
      const ratio = srcRate / tgtRate;
      // Account for carried fractional position when calculating output length
      const available = input.length - this._resamplePos;
      const outLen = Math.max(0, Math.floor(available / ratio));
      samples = new Float32Array(outLen);

      for (let i = 0; i < outLen; i++) {
        const srcIdx = this._resamplePos + i * ratio;
        const idx0 = Math.floor(srcIdx);
        const idx1 = Math.min(idx0 + 1, input.length - 1);
        const frac = srcIdx - idx0;
        samples[i] = input[idx0] * (1 - frac) + input[idx1] * frac;
      }

      // Carry the exact fractional remainder into the next block
      this._resamplePos = (this._resamplePos + outLen * ratio) - input.length;
      // Clamp to prevent drift from floating-point accumulation
      if (this._resamplePos < 0) this._resamplePos = 0;
    }

    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    this.port.postMessage(out.buffer, [out.buffer]);
    return true;
  }
}

registerProcessor('pcm16-writer', PCM16Writer);
