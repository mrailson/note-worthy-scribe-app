import { createPcmStream } from '@/lib/audio/pcm16';

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
  private ws: WebSocket | null = null;
  private audioStream: { stop: () => void } | null = null;
  private isRecording = false;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;
  private shouldReconnect = true;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    console.log('🚀 Starting Deepgram realtime transcription...');
    
    try {
      this.shouldReconnect = true;
      this.onStatusChange('Connecting...');
      
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-streaming`;
      console.log('📡 Connecting to Deepgram WebSocket at:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ Connected to Deepgram WebSocket proxy');
        this.onStatusChange('connected');
        
        // Send session start message to initialize Deepgram connection
        this.ws?.send(JSON.stringify({ type: 'session.start' }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📝 Deepgram message received:', data.type || data.message_type || 'transcription');
          
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
          // Deepgram sends results in channel.alternatives format
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
                  // Extract speaker from word-level data if available
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
          
          // Handle VAD events (Voice Activity Detection)
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
      };

      this.ws.onerror = (error) => {
        console.error('❌ Deepgram WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('🔌 Deepgram WebSocket closed - Code:', event.code, 'Reason:', event.reason);
        this.isRecording = false;
        
        if (event.code !== 1000 && this.shouldReconnect) {
          console.log('🔄 Connection lost unexpectedly, attempting reconnection...');
          this.handleReconnection();
        } else {
          console.log('🔌 Clean WebSocket closure');
          this.onStatusChange('Disconnected');
          this.cleanup();
        }
      };

    } catch (error) {
      console.error('❌ Failed to start Deepgram:', error);
      this.onError('Failed to start transcription: ' + (error as Error).message);
      this.cleanup();
    }
  }

  private async startAudioCapture() {
    try {
      console.log('🎙️ Starting audio capture for Deepgram...');
      
      // Start audio capture and streaming using PCM16 format
      this.audioStream = await createPcmStream((audioBuffer) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send raw PCM audio bytes to Deepgram
          this.ws.send(audioBuffer);
        }
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
    this.shouldReconnect = false;
    this.isRecording = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Send terminate message before closing
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        console.log('📤 Sending terminate message to Deepgram...');
        this.ws.send(JSON.stringify({ type: 'terminate' }));
      } catch (e) {
        console.log('Could not send terminate message:', e);
      }
    }
    
    this.cleanup();
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
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
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    this.onStatusChange(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = window.setTimeout(async () => {
      if (!this.shouldReconnect) return;
      
      try {
        await this.startTranscription();
        this.reconnectAttempts = 0; // Reset on successful connection
        this.isReconnecting = false;
        console.log('✅ Reconnection successful');
      } catch (error) {
        console.error('❌ Reconnection failed:', error);
        this.isReconnecting = false;
        this.handleReconnection(); // Try again
      }
    }, delay);
  }

  async clearSummary() {
    console.log('Deepgram summary cleared');
  }
}
