import { createPcmStream } from '@/lib/audio/pcm16';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
}

export class GoogleCloudSpeechTranscriber {
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
    console.log('🚀 Starting Google Cloud Speech transcription...');
    
    try {
      this.shouldReconnect = true;
      this.onStatusChange('Connecting...');
      
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/google-speech-streaming`;
      console.log('📡 Connecting to Google Cloud Speech WebSocket at:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ Connected to Google Cloud Speech WebSocket proxy');
        this.onStatusChange('connected');
        
        // Send session start message
        this.ws?.send(JSON.stringify({ 
          type: 'session.start',
          config: {
            language: 'en-GB',
            model: 'latest_long',
            enableAutomaticPunctuation: true,
            sampleRateHertz: 24000
          }
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📝 Google Cloud Speech message received:', data);
          
          if (data.type === 'error') {
            console.error('❌ Google Cloud Speech error:', data.error);
            this.onError(`Google Cloud Speech error: ${data.error}`);
            return;
          }
          
          if (data.type === 'session_begins') {
            console.log('✅ Google Cloud Speech session began, starting audio capture...');
            this.sessionId = data.session_id || Date.now().toString();
            this.onStatusChange('connected');
            this.startAudioCapture();
            return;
          }
          
          // Handle transcription results
          if (data.type === 'transcription' || data.results) {
            const results = data.results || [data];
            for (const result of results) {
              const transcript = result.alternatives?.[0]?.transcript || result.transcript;
              if (transcript?.trim()) {
                const transcriptData: TranscriptData = {
                  text: transcript.trim(),
                  is_final: result.isFinal || result.is_final || false,
                  confidence: result.alternatives?.[0]?.confidence || result.confidence || 0.9
                };
                
                console.log(`📝 ${transcriptData.is_final ? 'Final' : 'Partial'} transcript:`, transcriptData.text);
                this.onTranscription(transcriptData);
              }
            }
            return;
          }
          
          if (data.type === 'session_terminated') {
            console.log('🔌 Google Cloud Speech session terminated');
            this.isRecording = false;
            this.onStatusChange('Disconnected');
            return;
          }
          
        } catch (parseError) {
          console.error('❌ Error parsing Google Cloud Speech message:', parseError);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Google Cloud Speech WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('🔌 Google Cloud Speech WebSocket closed - Code:', event.code);
        this.isRecording = false;
        
        if (event.code !== 1000 && this.shouldReconnect) {
          this.handleReconnection();
        } else {
          this.onStatusChange('Disconnected');
          this.cleanup();
        }
      };

    } catch (error) {
      console.error('❌ Failed to start Google Cloud Speech:', error);
      this.onError('Failed to start transcription: ' + (error as Error).message);
      this.cleanup();
    }
  }

  private async startAudioCapture() {
    try {
      console.log('🎙️ Starting audio capture for Google Cloud Speech...');
      
      this.audioStream = await createPcmStream((audioBuffer) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(audioBuffer);
        }
      });
      
      this.isRecording = true;
      this.onStatusChange('recording');
      console.log('🎙️ Audio streaming to Google Cloud Speech started');
      
    } catch (audioError) {
      console.error('❌ Audio capture error:', audioError);
      this.onError('Failed to start audio capture: ' + (audioError as Error).message);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Google Cloud Speech transcription...');
    this.shouldReconnect = false;
    this.isRecording = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
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
      } catch (error) {
        this.isReconnecting = false;
        this.handleReconnection();
      }
    }, delay);
  }

  async clearSummary() {
    console.log('Google Cloud Speech summary cleared');
  }
}
