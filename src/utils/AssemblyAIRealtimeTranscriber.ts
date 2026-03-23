import { createPcmStream } from '@/lib/audio/pcm16';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
}

/**
 * AssemblyAI Realtime Transcriber — used by Meetings / Dual Transcription.
 *
 * FIXED 2026-03-23:
 * - v3 messages are detected by duck-typing ('transcript' in data && 'end_of_turn' in data)
 *   rather than checking data.type === 'Turn' (which never matched — root cause of silence).
 * - Added turn-order tracking with 30s safety timer (aligned with AssemblyRealtimeClient).
 * - v3 sends cumulative turn text; we now extract only uncommitted words before emitting finals.
 * - Reduced per-message and per-audio-frame logging to avoid console flooding.
 */
export class AssemblyAIRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private audioStream: { stop: () => void } | null = null;
  private isActive = false;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;
  private shouldReconnect = true;

  // v3 turn-order tracking (aligned with AssemblyRealtimeClient)
  private currentTurnOrder: number = -1;
  private currentTurnText: string = "";
  private committedWordCount: number = 0;
  private turnCommitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly TURN_COMMIT_TIMEOUT_MS = 30000;

  // Diagnostic counters (reduced logging)
  private totalMessageCount = 0;
  private endOfTurnCount = 0;
  private partialCount = 0;
  private audioFramesSent = 0;
  private lastDiagLogTime = 0;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    private formatTurns: boolean = true
  ) {}

  async startTranscription() {
    console.log('🚀 AssemblyAIRealtimeTranscriber: starting...');
    
    try {
      this.shouldReconnect = true;
      this.onStatusChange('Connecting...');
      
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-realtime`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ AssemblyAIRealtimeTranscriber: proxy connected');
        this.onStatusChange('connected');
        // Proxy auto-initialises the AssemblyAI connection and sends session_begins
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.totalMessageCount++;

          // Periodic diagnostic log (not every message)
          if (this.totalMessageCount <= 3 || this.totalMessageCount % 50 === 0) {
            const preview = typeof event.data === 'string'
              ? event.data.substring(0, 150)
              : '[binary]';
            console.log(`📝 AAI msg #${this.totalMessageCount}: ${preview}`);
          }
          
          // ── Error ──
          if (data.type === 'error') {
            console.error('❌ AssemblyAI error:', data.error);
            this.onError(`AssemblyAI error: ${data.error}`);
            return;
          }
          
          // ── Session begins (from proxy) ──
          if (data.type === 'session_begins' || data.message_type === 'SessionBegins') {
            console.log('✅ AssemblyAI session began, starting audio capture...');
            this.sessionId = data.session_id || Date.now().toString();
            this.onStatusChange('connected');
            this.startAudioCapture();
            return;
          }
          
          // ═══════════════════════════════════════════════════════════════
          // FIX: v3 message detection by duck-typing (no 'type' field!)
          // v3 messages look like: { transcript: "...", end_of_turn: bool, turn_order: N }
          // The old code checked data.type === 'Turn' which NEVER matched.
          // ═══════════════════════════════════════════════════════════════
          if ('transcript' in data && 'end_of_turn' in data) {
            const text = String(data.transcript ?? "").trim();
            if (!text) return;
            this.handleTurnMessage(data, text);
            return;
          }
          
          // ── Legacy v2: PartialTranscript ──
          if (data.message_type === 'PartialTranscript') {
            const transcript = data.text?.trim();
            if (transcript) {
              this.partialCount++;
              this.onTranscription({
                text: transcript,
                is_final: false,
                confidence: data.confidence || 0.8
              });
            }
            return;
          }
          
          // ── Legacy v2: FinalTranscript ──
          if (data.message_type === 'FinalTranscript') {
            const transcript = data.text?.trim();
            if (transcript) {
              this.endOfTurnCount++;
              this.onTranscription({
                text: transcript,
                is_final: true,
                confidence: data.confidence || 0.9,
                start: data.audio_start,
                end: data.audio_end
              });
            }
            return;
          }
          
          // ── Session info ──
          if (data.message_type === 'SessionInformation') {
            console.log('ℹ️ AssemblyAI session info:', data);
            return;
          }
          
          // ── Session terminated ──
          if (data.type === 'session_terminated') {
            console.log('🔌 AssemblyAI session terminated');
            this.isActive = false;
            this.onStatusChange('Disconnected');
            return;
          }
          
          // Only log truly unknown messages
          if (this.totalMessageCount <= 10) {
            console.log('❓ Unknown message shape:', JSON.stringify(data).substring(0, 200));
          }
          
        } catch (parseError) {
          console.error('❌ Error parsing AssemblyAI message:', parseError);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ AssemblyAI WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 AssemblyAI closed: code=${event.code}, reason=${event.reason}, msgs=${this.totalMessageCount}, finals=${this.endOfTurnCount}, partials=${this.partialCount}, audioFrames=${this.audioFramesSent}`);
        this.isActive = false;
        
        if (event.code !== 1000 && this.shouldReconnect) {
          console.log('🔄 Connection lost, attempting reconnection...');
          this.handleReconnection();
        } else {
          this.onStatusChange('Disconnected');
          this.cleanup();
        }
      };

    } catch (error: any) {
      console.error('❌ Failed to start AssemblyAI:', error);
      this.onError('Failed to start transcription: ' + error.message);
      this.cleanup();
    }
  }

  // ── v3 turn handler (aligned with AssemblyRealtimeClient) ──────────────

  private handleTurnMessage(data: any, text: string) {
    const turnOrder = typeof data?.turn_order === 'number' ? data.turn_order : -1;

    // end_of_turn: commit only the NEW portion and reset
    if (data?.end_of_turn === true) {
      this.endOfTurnCount++;
      const newText = this.getUncommittedText(text);
      if (newText) {
        console.log(`✅ AAI final #${this.endOfTurnCount}: "${newText.substring(0, 80)}..." turn:${turnOrder}`);
        this.onTranscription({
          text: newText,
          is_final: true,
          confidence: data.end_of_turn_confidence || 0.9
        });
      }
      this.currentTurnText = "";
      this.currentTurnOrder = -1;
      this.committedWordCount = 0;
      if (this.turnCommitTimer) { clearTimeout(this.turnCommitTimer); this.turnCommitTimer = null; }
      return;
    }

    // Turn order changed — commit remaining text from previous turn
    if (turnOrder !== -1 && turnOrder !== this.currentTurnOrder && this.currentTurnOrder !== -1) {
      const remaining = this.getUncommittedText(this.currentTurnText);
      if (remaining) {
        this.endOfTurnCount++;
        console.log(`🔄 AAI turn change ${this.currentTurnOrder}→${turnOrder}: "${remaining.substring(0, 80)}..."`);
        this.onTranscription({
          text: remaining,
          is_final: true,
          confidence: 0.85
        });
      }
      this.committedWordCount = 0;
    }

    // New turn started
    if (turnOrder !== -1 && turnOrder !== this.currentTurnOrder) {
      this.currentTurnOrder = turnOrder;
      this.committedWordCount = 0;

      // 30-second safety timer — commit accumulated NEW text
      if (this.turnCommitTimer) clearTimeout(this.turnCommitTimer);
      this.turnCommitTimer = setTimeout(() => this.handleTimerFlush(), this.TURN_COMMIT_TIMEOUT_MS);
    }

    // v3 sends full cumulative turn text — track and emit as partial
    this.currentTurnText = text;
    this.partialCount++;
    this.onTranscription({
      text: text,
      is_final: false,
      confidence: 0.8
    });
  }

  private handleTimerFlush() {
    const newText = this.getUncommittedText(this.currentTurnText);
    if (newText) {
      this.endOfTurnCount++;
      console.log(`⏰ AAI 30s timer: committing ${newText.split(/\s+/).length} new words`);
      this.onTranscription({
        text: newText,
        is_final: true,
        confidence: 0.85
      });
      this.committedWordCount = this.currentTurnText.trim().split(/\s+/).length;
    }
    // Re-arm if turn is still open
    if (this.currentTurnOrder !== -1) {
      this.turnCommitTimer = setTimeout(() => this.handleTimerFlush(), this.TURN_COMMIT_TIMEOUT_MS);
    }
  }

  /**
   * Extract only the words from fullText that haven't been committed yet.
   * v3 sends cumulative text, so we skip the first committedWordCount words.
   */
  private getUncommittedText(fullText: string): string {
    if (!fullText?.trim()) return "";
    if (this.committedWordCount === 0) return fullText.trim();
    const words = fullText.trim().split(/\s+/);
    if (words.length <= this.committedWordCount) return "";
    return words.slice(this.committedWordCount).join(' ');
  }

  // ── Audio capture ──────────────────────────────────────────────────────

  private async startAudioCapture() {
    try {
      console.log('🎙️ Starting audio capture for AssemblyAI...');
      
      this.audioStream = await createPcmStream((audioBuffer) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(audioBuffer);
          this.audioFramesSent++;

          // Periodic diagnostic (not every frame)
          if (this.audioFramesSent === 1) {
            console.log(`🔍 First audio frame: ${audioBuffer.byteLength} bytes`);
          }
          const now = Date.now();
          if (now - this.lastDiagLogTime >= 5000) {
            this.lastDiagLogTime = now;
            console.log(`📡 Audio: frame #${this.audioFramesSent}, msgs back: ${this.totalMessageCount} (${this.endOfTurnCount} finals, ${this.partialCount} partials)`);
          }
        }
      });
      
      this.isActive = true;
      this.onStatusChange('recording');
      console.log('🎙️ Audio streaming started successfully');
      
    } catch (audioError: any) {
      console.error('❌ Audio capture error:', audioError);
      this.onError('Failed to start audio capture: ' + audioError.message);
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────

  stopTranscription() {
    console.log(`🛑 Stopping AssemblyAI (msgs: ${this.totalMessageCount}, finals: ${this.endOfTurnCount}, partials: ${this.partialCount}, audioFrames: ${this.audioFramesSent})`);
    this.shouldReconnect = false;
    this.isActive = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Flush any uncommitted turn text before stopping
    if (this.currentTurnText.trim()) {
      const remaining = this.getUncommittedText(this.currentTurnText);
      if (remaining) {
        console.log(`📚 Flushing ${remaining.split(/\s+/).length} uncommitted words on stop`);
        this.onTranscription({
          text: remaining,
          is_final: true,
          confidence: 0.85
        });
      }
      this.currentTurnText = "";
      this.currentTurnOrder = -1;
      this.committedWordCount = 0;
    }
    if (this.turnCommitTimer) { clearTimeout(this.turnCommitTimer); this.turnCommitTimer = null; }
    
    // Send terminate message before closing
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'terminate' }));
      } catch (e) {
        console.log('Could not send terminate message:', e);
      }
    }
    
    this.cleanup();
    this.onStatusChange('Stopped');
  }

  isRecording(): boolean {
    return this.isActive;
  }

  private cleanup() {
    if (this.audioStream) {
      this.audioStream.stop();
      this.audioStream = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleReconnection() {
    if (!this.shouldReconnect || this.isReconnecting) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached. Stopping.');
      this.onError(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
      this.onStatusChange('Failed');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.onStatusChange(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(async () => {
      if (!this.shouldReconnect) return;
      
      try {
        await this.startTranscription();
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        console.log('✅ Reconnection successful');
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        this.isReconnecting = false;
        this.handleReconnection();
      }
    }, delay);
  }

  async clearSummary() {
    console.log('AssemblyAI does not support summary clearing in realtime mode');
  }
}