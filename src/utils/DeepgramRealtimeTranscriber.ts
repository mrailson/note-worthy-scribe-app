import { createPcmStream } from '@/lib/audio/pcm16';
import { WebSocketReconnectManager } from '@/lib/audio/WebSocketReconnectManager';
import { supabase } from '@/integrations/supabase/client';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: number;
  }>;
}

export class DeepgramRealtimeTranscriber {
  private manager: WebSocketReconnectManager | null = null;
  private audioStream: { stop: () => void } | null = null;
  private isRecording = false;
  private sessionId: string | null = null;
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    console.log('🚀 Starting Deepgram realtime transcription...');
    
    try {
      this.onStatusChange('Connecting...');
      
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-streaming`;
      console.log('📡 Connecting to Deepgram WebSocket at:', wsUrl);

      this.manager = new WebSocketReconnectManager({
        label: 'Deepgram',
        maxAttempts: 8,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        jitterFactor: 0.3,

        createWebSocket: () => {
          const ws = new WebSocket(wsUrl);
          ws.binaryType = 'arraybuffer';
          return ws;
        },

        onConnected: (ws) => {
          console.log('✅ Connected to Deepgram WebSocket proxy');
          this.onStatusChange('connected');
          // Send session start message to initialise Deepgram connection
          ws.send(JSON.stringify({ type: 'session.start' }));
          this.startKeepalive();
        },

        onMessage: (event) => {
          this.handleMessage(event);
        },

        onAttempt: (attempt, max, delayMs) => {
          console.log(`🔄 Reconnection attempt ${attempt}/${max} in ${delayMs}ms`);
          this.onStatusChange(`Reconnecting... (${attempt}/${max})`);
          this.stopKeepalive();
        },

        onGaveUp: (attempts) => {
          console.log(`❌ Max reconnection attempts (${attempts}) reached. Stopping.`);
          this.onError(`Failed to reconnect after ${attempts} attempts`);
          this.onStatusChange('Failed');
          this.stopKeepalive();
        },

        onFinalClose: () => {
          this.onStatusChange('Disconnected');
          this.stopKeepalive();
        },
      });

      this.manager.connect();

    } catch (error) {
      console.error('❌ Failed to start Deepgram:', error);
      this.onError('Failed to start transcription: ' + (error as Error).message);
      this.cleanup();
    }
  }

  private handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      console.log('📝 Deepgram message received:', data.type || data.message_type || 'transcription');

      // Handle keepalive pong
      if (data.type === 'pong') return;

      // Handle error messages
      if (data.type === 'error') {
        console.error('❌ Deepgram error:', data.error);
        this.onError(`Deepgram error: ${data.error}`);
        return;
      }

      // Handle session start confirmation
      if (data.type === 'session_begins') {
        console.log('✅ Deepgram session began, starting audio capture...');
        this.sessionId = data.session_id || Date.now().toString();
        this.onStatusChange('connected');
        this.startAudioCapture();
        return;
      }

      // Handle Deepgram transcription results
      if (data.channel?.alternatives || data.results?.channels) {
        const channels = data.channel?.alternatives 
          ? [{ alternatives: data.channel.alternatives }]
          : (data.results?.channels || []);
        
        for (const channel of channels) {
          const alternatives = channel.alternatives || [];
          if (alternatives.length > 0) {
            const bestAlt = alternatives[0];
            const transcript = bestAlt.transcript?.trim();
            
            if (transcript) {
              const words = bestAlt.words || [];
              let speakerLabel: string | undefined;
              if (words.length > 0 && words[0]?.speaker !== undefined) {
                speakerLabel = `Speaker ${words[0].speaker + 1}`;
              }
              
              const transcriptData: TranscriptData = {
                text: transcript,
                is_final: data.is_final || data.speech_final || false,
                confidence: bestAlt.confidence || 0.9,
                speaker: speakerLabel,
                words: bestAlt.words?.map((w: any) => ({
                  word: w.word,
                  start: w.start,
                  end: w.end,
                  confidence: w.confidence,
                  speaker: w.speaker
                }))
              };
              
              console.log(`📝 ${transcriptData.is_final ? 'Final' : 'Partial'} Deepgram transcript${speakerLabel ? ` [${speakerLabel}]` : ''}:`, transcript.substring(0, 50));
              this.onTranscription(transcriptData);
            }
          }
        }
        return;
      }

      // Handle session termination
      if (data.type === 'session_terminated') {
        console.log('🔌 Deepgram session terminated');
        this.isRecording = false;
        this.onStatusChange('Disconnected');
        return;
      }

      // Handle VAD events
      if (data.type === 'SpeechStarted' || data.type === 'speech_started') {
        console.log('🎤 Speech detected');
        return;
      }

      // Handle utterance end
      if (data.type === 'UtteranceEnd' || data.speech_final) {
        console.log('🔚 Utterance ended');
        return;
      }

      console.log('❓ Unknown Deepgram message type:', data.type);

    } catch (parseError) {
      console.error('❌ Error parsing Deepgram message:', parseError, 'Raw data:', event.data);
    }
  }

  private async startAudioCapture() {
    // Don't restart audio if it's already running (survives reconnections)
    if (this.audioStream) {
      console.log('🎙️ Audio capture already active — reusing across reconnection');
      return;
    }

    try {
      console.log('🎙️ Starting audio capture for Deepgram...');
      
      this.audioStream = await createPcmStream((audioBuffer) => {
        // Send through the manager — silently drops if not connected
        this.manager?.send(audioBuffer);
      });
      
      this.isRecording = true;
      this.onStatusChange('recording');
      console.log('🎙️ Audio streaming to Deepgram started successfully');
      
    } catch (audioError) {
      console.error('❌ Audio capture error:', audioError);
      this.onError('Failed to start audio capture: ' + (audioError as Error).message);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Deepgram transcription...');
    this.isRecording = false;
    this.stopKeepalive();
    
    // Send terminate message before the manager closes
    if (this.manager?.connected) {
      try {
        console.log('📤 Sending terminate message to Deepgram...');
        this.manager.send(JSON.stringify({ type: 'terminate' }));
      } catch (e) {
        console.log('Could not send terminate message:', e);
      }
    }

    // Manager handles removing handlers before closing — no zombie onclose
    if (this.manager) {
      this.manager.stop();
      this.manager = null;
    }

    // Stop audio stream only on intentional stop
    if (this.audioStream) {
      this.audioStream.stop();
      this.audioStream = null;
    }
    
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  private cleanup() {
    this.stopKeepalive();

    if (this.audioStream) {
      this.audioStream.stop();
      this.audioStream = null;
    }
    
    if (this.manager) {
      this.manager.stop();
      this.manager = null;
    }
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveInterval = setInterval(() => {
      if (this.manager?.connected) {
        try {
          this.manager.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Will be caught by onerror/onclose in manager
        }
      }
    }, 20000); // Every 20 seconds
  }

  private stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  async clearSummary() {
    console.log('Deepgram summary cleared');
  }
}
