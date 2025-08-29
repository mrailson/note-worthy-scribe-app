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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private isReconnecting = false;
  private shouldReconnect = true;

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
      this.shouldReconnect = true;
      this.onStatusChange('Connecting...');
      
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-realtime`;
      console.log('📡 Connecting to AssemblyAI WebSocket at:', wsUrl);
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ Connected to AssemblyAI WebSocket proxy');
        this.onStatusChange('connected');
        // The proxy will auto-initialize the AssemblyAI connection
        // and send session_begins when ready
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📝 AssemblyAI message received:', data);
          console.log('📝 Message type:', data.message_type, 'Type:', data.type);
          
          // Handle different message types from AssemblyAI
          if (data.type === 'error') {
            console.error('❌ AssemblyAI error:', data.error);
            this.onError(`AssemblyAI error: ${data.error}`);
            return;
          }
          
          if (data.type === 'session_begins' || data.message_type === 'SessionBegins') {
            console.log('✅ AssemblyAI session began, starting audio capture...');
            this.sessionId = data.session_id || Date.now().toString();
            this.onStatusChange('connected');
            this.startAudioCapture();
            return;
          }
          
          // Handle Turn messages (AssemblyAI's real format)
          if (data.type === 'Turn') {
            const transcript = data.transcript?.trim();
            console.log('🎯 Processing Turn message - transcript:', transcript, 'end_of_turn:', data.end_of_turn);
            if (transcript) {
              const transcriptData: TranscriptData = {
                text: transcript,
                is_final: data.end_of_turn || false,
                confidence: data.end_of_turn_confidence || 0.8
              };
              
              console.log(`📝 ${data.end_of_turn ? 'Final' : 'Partial'} transcript calling onTranscription:`, transcriptData);
              this.onTranscription(transcriptData);
            } else {
              console.log('⚠️ Turn message has no transcript text');
            }
            return;
          }
          
          // Handle legacy format (keep for compatibility)
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
          
          // Handle legacy format (keep for compatibility)
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
          
          console.log('❓ Unknown message type received:', data.type || data.message_type);
          
        } catch (parseError) {
          console.error('❌ Error parsing AssemblyAI message:', parseError, 'Raw data:', event.data);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ AssemblyAI WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('🔌 AssemblyAI WebSocket closed - Code:', event.code, 'Reason:', event.reason, 'WasClean:', event.wasClean);
        this.isActive = false;
        
        if (event.code !== 1000 && this.shouldReconnect) {
          console.log('🔄 Connection lost unexpectedly, attempting reconnection...');
          this.handleReconnection();
        } else {
          console.log('🔌 Clean WebSocket closure, not reconnecting');
          this.onStatusChange('Disconnected');
          this.cleanup();
        }
      };

    } catch (error) {
      console.error('❌ Failed to start AssemblyAI:', error);
      this.onError('Failed to start transcription: ' + error.message);
      this.cleanup();
    }
  }

  private async startAudioCapture() {
    try {
      console.log('🎙️ Starting audio capture for AssemblyAI...');
      
      // Start audio capture and streaming
      this.audioStream = await createPcmStream((audioBuffer) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log('📡 Sending audio chunk to AssemblyAI:', audioBuffer.byteLength, 'bytes');
          this.ws.send(audioBuffer);
        } else {
          console.warn('⚠️ WebSocket not ready, skipping audio chunk');
        }
      });
      
      this.isActive = true;
      this.onStatusChange('recording');
      console.log('🎙️ Audio streaming to AssemblyAI started successfully');
      
    } catch (audioError) {
      console.error('❌ Audio capture error:', audioError);
      this.onError('Failed to start audio capture: ' + audioError.message);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping AssemblyAI transcription... (called by user or auto-stop)');
    this.shouldReconnect = false;
    this.isActive = false;
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Send terminate message before closing
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        console.log('📤 Sending terminate message to AssemblyAI...');
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
    // AssemblyAI doesn't have a built-in summary feature in realtime
    // This method exists for consistency with other transcribers
    console.log('AssemblyAI does not support summary clearing in realtime mode');
  }
}