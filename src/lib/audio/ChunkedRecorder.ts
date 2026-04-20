/**
 * ChunkedRecorder
 * 
 * Produces independent audio file segments during recording.
 * Each segment is a standalone valid webm file that can be
 * independently uploaded and transcribed.
 */

export interface AudioChunk {
  index: number;
  blob: Blob;
  startTimeMs: number;    // offset from recording start
  endTimeMs: number;
  durationMs: number;
  sizeBytes: number;
}

export type AudioBitrate = 64000 | 32000 | 24000;

export const BITRATE_OPTIONS: { value: AudioBitrate; label: string; description: string }[] = [
  { value: 64000, label: '64 kbps', description: 'High quality — best for noisy rooms or many speakers' },
  { value: 32000, label: '32 kbps', description: 'Balanced — recommended for most meetings' },
  { value: 24000, label: '24 kbps', description: 'Compact — good for quiet 1-to-1 consultations' },
];

export interface ChunkedRecorderOptions {
  chunkDurationMs?: number;        // Default: 15 minutes
  audioBitrate?: AudioBitrate;     // Default: 32000
  audioConstraints?: MediaTrackConstraints;
  onChunkReady?: (chunk: AudioChunk) => void;
  onStatusChange?: (status: RecorderStatus) => void;
  overlapMs?: number;              // Default: 2000 (2s overlap to avoid cutting words)
}

export type RecorderStatus = 'idle' | 'recording' | 'switching' | 'stopping' | 'stopped';

const DEFAULT_CHUNK_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_OVERLAP_MS = 2000;

export class ChunkedRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private currentChunks: Blob[] = [];
  private allCompletedChunks: AudioChunk[] = [];
  private chunkIndex = 0;
  private chunkStartTime = 0;
  private recordingStartTime = 0;
  private chunkTimer: ReturnType<typeof setTimeout> | null = null;
  private status: RecorderStatus = 'idle';
  
  private readonly chunkDurationMs: number;
  private readonly audioBitrate: AudioBitrate;
  private readonly overlapMs: number;
  private readonly audioConstraints: MediaTrackConstraints;
  private readonly onChunkReady?: (chunk: AudioChunk) => void;
  private readonly onStatusChange?: (status: RecorderStatus) => void;

  constructor(options: ChunkedRecorderOptions = {}) {
    this.chunkDurationMs = options.chunkDurationMs ?? DEFAULT_CHUNK_DURATION_MS;
    this.audioBitrate = options.audioBitrate ?? 32000;
    this.overlapMs = options.overlapMs ?? DEFAULT_OVERLAP_MS;
    this.onChunkReady = options.onChunkReady;
    this.onStatusChange = options.onStatusChange;
    // iOS Safari: all three DSP flags must be set explicitly. Omitting
    // autoGainControl previously left it at the UA default (off on iOS),
    // which contributed to gain swings on quieter speakers and missed
    // unstressed words like negations ("aren't", "don't").
    this.audioConstraints = options.audioConstraints ?? {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1,
    };
  }

  async start(): Promise<void> {
    if (this.status === 'recording') throw new Error('Already recording');
    this.allCompletedChunks = [];
    this.chunkIndex = 0;
    this.recordingStartTime = Date.now();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: this.audioConstraints });
    this.setStatus('recording');
    this.startNewChunk();
  }

  async stop(): Promise<AudioChunk[]> {
    if (this.status !== 'recording' && this.status !== 'switching') return this.allCompletedChunks;
    this.setStatus('stopping');
    if (this.chunkTimer) { clearTimeout(this.chunkTimer); this.chunkTimer = null; }
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      await this.finaliseCurrentChunk();
    }
    if (this.stream) { this.stream.getTracks().forEach(track => track.stop()); this.stream = null; }
    this.setStatus('stopped');
    return this.allCompletedChunks;
  }

  get elapsedMs(): number {
    if (this.status === 'idle') return 0;
    return Date.now() - this.recordingStartTime;
  }

  get completedChunkCount(): number { return this.allCompletedChunks.length; }
  get currentStatus(): RecorderStatus { return this.status; }
  get mediaStream(): MediaStream | null { return this.stream; }

  private startNewChunk(): void {
    if (!this.stream) return;
    this.currentChunks = [];
    this.chunkStartTime = Date.now();
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: this.audioBitrate });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.currentChunks.push(event.data);
    };
    this.mediaRecorder.start(1000);
    const rotationDelay = this.chunkDurationMs - this.overlapMs;
    this.chunkTimer = setTimeout(() => this.rotateChunk(), rotationDelay);
  }

  private async rotateChunk(): Promise<void> {
    this.setStatus('switching');
    await this.finaliseCurrentChunk();
    this.setStatus('recording');
    this.startNewChunk();
  }

  private finaliseCurrentChunk(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') { resolve(); return; }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.currentChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm;codecs=opus' });
        const now = Date.now();
        const chunk: AudioChunk = {
          index: this.chunkIndex, blob,
          startTimeMs: this.chunkStartTime - this.recordingStartTime,
          endTimeMs: now - this.recordingStartTime,
          durationMs: now - this.chunkStartTime,
          sizeBytes: blob.size,
        };
        this.allCompletedChunks.push(chunk);
        this.chunkIndex++;
        this.onChunkReady?.(chunk);
        this.currentChunks = [];
        resolve();
      };
      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (const mime of candidates) { if (MediaRecorder.isTypeSupported(mime)) return mime; }
    return 'audio/webm';
  }

  private setStatus(status: RecorderStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }
}
