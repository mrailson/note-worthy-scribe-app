// Enhanced Deepgram Transcriber with proper WebSocket integration
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

export class DeepgramTranscriber {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private recordingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private keepAlive: NodeJS.Timeout | null = null;
  private fallbackToWhisper = false;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void,
    meetingId?: string
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Connecting to Deepgram...');
      console.log('🔗 Starting Deepgram transcription...');

      // First try to establish WebSocket connection to Deepgram
      await this.connectToDeepgram();

      if (this.fallbackToWhisper) {
        console.log('🔄 Falling back to Whisper transcription');
        await this.startWhisperFallback();
        return;
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          // Convert blob to ArrayBuffer and send to Deepgram
          event.data.arrayBuffer().then(buffer => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(buffer);
            }
          });
        }
      };

      this.isRecording = true;
      this.onStatusChange('Recording with Deepgram');
      
      // Start recording and send audio chunks to Deepgram
      this.startContinuousRecording();
      
      console.log('🎙️ Deepgram transcription started');
    } catch (error) {
      console.error('❌ Failed to start Deepgram transcription:', error);
      this.onError(`Failed to start Deepgram: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Try fallback to Whisper
      console.log('🔄 Attempting fallback to Whisper...');
      this.fallbackToWhisper = true;
      await this.startWhisperFallback();
    }
  }

  private async connectToDeepgram(): Promise<void> {
    try {
      // Get Deepgram API key from Supabase secrets
      const { data, error } = await supabase.functions.invoke('deepgram-realtime', {
        body: { action: 'connect' }
      });

      if (error) {
        throw new Error('Failed to get Deepgram connection');
      }

      const websocketUrl = data.websocketUrl;
      
      return new Promise((resolve, reject) => {
        this.ws = new WebSocket(websocketUrl);
        
        this.ws.onopen = () => {
          console.log('✅ Connected to Deepgram WebSocket');
          this.reconnectAttempts = 0;
          this.startKeepAlive();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleDeepgramMessage(message);
          } catch (e) {
            console.error('❌ Error parsing Deepgram message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ Deepgram WebSocket error:', error);
          reject(new Error('Deepgram connection failed'));
        };

        this.ws.onclose = () => {
          console.log('🔌 Deepgram WebSocket closed');
          this.stopKeepAlive();
          
          if (this.isRecording && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect to Deepgram (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connectToDeepgram(), 2000);
          } else if (this.isRecording) {
            console.log('🔄 Max reconnect attempts reached, falling back to Whisper');
            this.fallbackToWhisper = true;
            this.startWhisperFallback();
          }
        };

        // Timeout for connection
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new Error('Deepgram connection timeout'));
          }
        }, 10000);
      });
    } catch (error) {
      console.error('❌ Failed to connect to Deepgram:', error);
      throw error;
    }
  }

  private handleDeepgramMessage(message: any) {
    if (message.channel?.alternatives?.length > 0) {
      const alternative = message.channel.alternatives[0];
      
      if (alternative.transcript && alternative.transcript.trim()) {
        const transcriptData: TranscriptData = {
          text: alternative.transcript.trim(),
          is_final: message.is_final || false,
          confidence: alternative.confidence || 0.8,
          start: message.start,
          end: message.start + message.duration,
          speaker: 'Speaker',
          words: alternative.words || []
        };

        console.log('📝 Deepgram transcription:', transcriptData.text, `(${transcriptData.is_final ? 'final' : 'interim'})`);
        this.onTranscription(transcriptData);

        if (this.onSummary && transcriptData.is_final) {
          this.onSummary(transcriptData.text);
        }
      }
    }

    if (message.type === 'Metadata') {
      console.log('📊 Deepgram metadata:', message);
    }

    if (message.error) {
      console.error('❌ Deepgram error:', message.error);
      this.onError(`Deepgram error: ${message.error}`);
    }
  }

  private startContinuousRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.start();
    
    // Send audio chunks every 250ms for low-latency transcription
    this.recordingInterval = setInterval(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        // Start recording again immediately
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.start();
          }
        }, 50);
      }
    }, 250);
  }

  private startKeepAlive() {
    this.keepAlive = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
      }
    }, 30000); // Keep alive every 30 seconds
  }

  private stopKeepAlive() {
    if (this.keepAlive) {
      clearInterval(this.keepAlive);
      this.keepAlive = null;
    }
  }

  private async startWhisperFallback() {
    try {
      this.onStatusChange('Using Whisper (fallback)');
      console.log('🔄 Starting Whisper fallback transcription...');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        if (this.audioChunks.length > 0) {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          this.audioChunks = [];
          await this.processWithWhisper(audioBlob);
        }
      };

      this.isRecording = true;
      this.onStatusChange('Recording with Whisper (fallback)');
      
      // Start recording in chunks for Whisper processing
      this.startWhisperChunkedRecording();
      
      console.log('✅ Whisper fallback started');
    } catch (error) {
      console.error('❌ Whisper fallback failed:', error);
      this.onError(`Whisper fallback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private startWhisperChunkedRecording() {
    if (!this.mediaRecorder) return;

    this.mediaRecorder.start();
    
    // Process audio in 3-second chunks for Whisper
    this.recordingInterval = setInterval(() => {
      if (this.mediaRecorder && this.isRecording && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
        // Start recording again immediately
        setTimeout(() => {
          if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.start();
          }
        }, 100);
      }
    }, 3000);
  }

  private async processWithWhisper(audioBlob: Blob) {
    try {
      console.log('🔄 Processing audio with Whisper fallback...');
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      return new Promise((resolve) => {
        reader.onload = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          
          try {
            const { data, error } = await supabase.functions.invoke('speech-to-text', {
              body: { audio: base64Audio }
            });

            if (error) {
              throw error;
            }

            if (data?.text && data.text.trim()) {
              const transcriptData: TranscriptData = {
                text: data.text.trim(),
                is_final: true,
                confidence: 0.8,
                speaker: 'Speaker'
              };

              this.onTranscription(transcriptData);
              
              if (this.onSummary) {
                this.onSummary(transcriptData.text);
              }
            }
            
            resolve(null);
          } catch (error) {
            console.error('❌ Whisper processing error:', error);
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('❌ Error processing with Whisper:', error);
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Deepgram/Whisper transcription...');
    this.isRecording = false;
    
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    
    this.stopKeepAlive();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.mediaRecorder) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      // Stop all tracks
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      this.mediaRecorder = null;
    }
    
    this.onStatusChange('Stopped');
    console.log('✅ Transcription stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  async clearSummary() {
    console.log('🧹 Clearing transcription summary');
    // Implementation depends on how summary is maintained
  }
}