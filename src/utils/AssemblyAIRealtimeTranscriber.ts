import { createPcmStream } from '@/lib/audio/pcm16';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
}

export class AssemblyAIRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private audioStream: { stop: () => void } | null = null;
  private isActive = false;
  private sessionId: string | null = null;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    private formatTurns: boolean = true
  ) {}

  async startTranscription() {
    console.log('🚀 Starting AssemblyAI realtime transcription...');
    
    try {
      this.onStatusChange('Connecting...');
      
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-realtime`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ Connected to AssemblyAI WebSocket proxy');
        this.onStatusChange('Connected - Starting audio capture...');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📝 AssemblyAI message received:', data);
          
          // Handle different message types from AssemblyAI
          if (data.type === 'error') {
            console.error('❌ AssemblyAI error:', data.error);
            this.onError(`AssemblyAI error: ${data.error}`);
            return;
          }
          
          if (data.type === 'session_begins' || data.message_type === 'SessionBegins') {
            console.log('✅ AssemblyAI session began, starting audio capture...');
            this.sessionId = data.session_id || Date.now().toString();
            this.startAudioCapture();
            return;
          }
          
          // Handle partial transcripts (real-time feedback)
          if (data.message_type === 'PartialTranscript') {
            const transcript = data.text?.trim();
            if (transcript) {
              const transcriptData: TranscriptData = {
                text: transcript,
                is_final: false,
                confidence: data.confidence || 0.8
              };
              
              console.log(`📝 Partial transcript:`, transcriptData.text);
              this.onTranscription(transcriptData);
            }
            return;
          }
          
          // Handle final transcripts (AssemblyAI's "turn" equivalent)
          if (data.message_type === 'FinalTranscript') {
            const transcript = data.text?.trim();
            if (transcript) {
              const transcriptData: TranscriptData = {
                text: transcript,
                is_final: true,
                confidence: data.confidence || 0.9,
                start: data.audio_start,
                end: data.audio_end
              };
              
              console.log(`📝 Final transcript:`, transcriptData.text);
              this.onTranscription(transcriptData);
            }
            return;
          }
          
          // Handle session information
          if (data.message_type === 'SessionInformation') {
            console.log('ℹ️ AssemblyAI session info:', data);
            return;
          }
          
          // Handle session termination
          if (data.type === 'session_terminated') {
            console.log('🔌 AssemblyAI session terminated');
            this.isActive = false;
            this.onStatusChange('Disconnected');
            return;
          }
          
        } catch (parseError) {
          console.error('❌ Error parsing AssemblyAI message:', parseError, 'Raw data:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ AssemblyAI WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('🔌 AssemblyAI WebSocket closed:', event.code, event.reason);
        this.isActive = false;
        
        if (event.code !== 1000) { // Not a normal closure
          this.onError('Connection closed unexpectedly');
        }
        
        this.onStatusChange('Disconnected');
        this.cleanup();
      };

    } catch (error) {
      console.error('❌ Failed to start AssemblyAI:', error);
      this.onError('Failed to start transcription: ' + error.message);
      this.cleanup();
    }
  }

  private async startAudioCapture() {
    try {
      // Start audio capture and streaming
      this.audioStream = await createPcmStream((audioBuffer) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(audioBuffer);
        }
      });
      
      this.isActive = true;
      this.onStatusChange('Recording');
      console.log('🎙️ Audio streaming to AssemblyAI started');
      
    } catch (audioError) {
      console.error('❌ Audio capture error:', audioError);
      this.onError('Failed to start audio capture: ' + audioError.message);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping AssemblyAI transcription...');
    this.isActive = false;
    
    // Send terminate message before closing
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'terminate' }));
      } catch (e) {
        console.log('Could not send terminate message:', e);
      }
    }
    
    this.cleanup();
    this.onStatusChange('Disconnected');
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

  async clearSummary() {
    // AssemblyAI doesn't have a built-in summary feature in realtime
    // This method exists for consistency with other transcribers
    console.log('AssemblyAI does not support summary clearing in realtime mode');
  }
}