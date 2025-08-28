import { createPcmStream } from '@/lib/audio/pcm16';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
}

export class AmazonTranscribeRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private audioStream: { stop: () => void } | null = null;
  private isActive = false;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    console.log('🚀 Starting Amazon Transcribe realtime transcription...');
    
    try {
      this.onStatusChange('Connecting...');
      
      // Connect to our WebSocket proxy
      const wsUrl = `wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/amazon-transcribe`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = async () => {
        console.log('✅ Connected to Amazon Transcribe WebSocket proxy');
        this.onStatusChange('Connected - Starting audio capture...');
        
        try {
          // Start audio capture and streaming
          this.audioStream = await createPcmStream((audioBuffer) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              console.log('📡 Sending audio chunk to Amazon Transcribe:', audioBuffer.byteLength, 'bytes');
              this.ws.send(audioBuffer);
            } else {
              console.warn('⚠️ WebSocket not ready, skipping audio chunk');
            }
          });
          
          this.isActive = true;
          this.onStatusChange('Recording');
          console.log('🎙️ Audio streaming to Amazon Transcribe started successfully');
          
        } catch (audioError) {
          console.error('❌ Audio capture error:', audioError);
          this.onError('Failed to start audio capture: ' + audioError.message);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          let data;
          
          // Handle both string and binary data
          if (typeof event.data === 'string') {
            data = JSON.parse(event.data);
          } else {
            const decoder = new TextDecoder();
            data = JSON.parse(decoder.decode(event.data));
          }
          
          console.log('📝 Amazon Transcribe message received:', data);
          
          // Handle error messages
          if (data.error) {
            console.error('❌ Amazon Transcribe error:', data.error);
            this.onError(`Amazon Transcribe error: ${data.error}`);
            return;
          }
          
          // Parse AWS Transcribe response format
          const results = data?.Transcript?.Results;
          if (Array.isArray(results)) {
            results.forEach((result: any) => {
              const alternative = result.Alternatives?.[0];
              if (alternative) {
                const transcript = alternative.Transcript?.trim();
                if (transcript) {
                  const transcriptData: TranscriptData = {
                    text: transcript,
                    is_final: !result.IsPartial,
                    confidence: alternative.Items?.[0]?.Confidence || 0.9
                  };
                  
                  console.log(`📝 Transcription (${transcriptData.is_final ? 'final' : 'partial'}):`, transcriptData.text);
                  this.onTranscription(transcriptData);
                }
              }
            });
          }
        } catch (parseError) {
          console.error('❌ Error parsing Amazon Transcribe message:', parseError);
          // Don't call onError for parsing errors as they might just be non-JSON messages
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ Amazon Transcribe WebSocket error:', error);
        this.onError('WebSocket connection error');
      };

      this.ws.onclose = (event) => {
        console.log('🔌 Amazon Transcribe WebSocket closed:', event.code, event.reason);
        this.isActive = false;
        
        if (event.code !== 1000) { // Not a normal closure
          this.onError('Connection closed unexpectedly');
        }
        
        this.onStatusChange('Disconnected');
        this.cleanup();
      };

    } catch (error) {
      console.error('❌ Failed to start Amazon Transcribe:', error);
      this.onError('Failed to start transcription: ' + error.message);
      this.cleanup();
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Amazon Transcribe transcription...');
    this.isActive = false;
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
    // Amazon Transcribe doesn't have a built-in summary feature
    // This method exists for consistency with other transcribers
    console.log('Amazon Transcribe does not support summary clearing');
  }
}