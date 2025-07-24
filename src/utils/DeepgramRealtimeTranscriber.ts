export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

export class DeepgramRealtimeTranscriber {
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Connecting...');
      await this.connectToWebSocket();
      await this.startAudioCapture();
      this.onStatusChange('Recording');
    } catch (error) {
      console.error('Error starting transcription:', error);
      this.onError(`Failed to start transcription: ${error}`);
    }
  }

  private async connectToWebSocket() {
    return new Promise<void>((resolve, reject) => {
      // Use the full WebSocket URL to the Supabase edge function
      this.ws = new WebSocket('wss://dphcnbricafkbtizkoal.functions.supabase.co/deepgram-realtime');

      this.ws.onopen = () => {
        console.log('Connected to Deepgram WebSocket proxy');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleDeepgramMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.onStatusChange('Disconnected');
      };

      // Set timeout for connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  private handleDeepgramMessage(data: string) {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'connection_established') {
        console.log('Deepgram connection established');
        return;
      }

      if (message.type === 'error') {
        this.onError(message.message);
        return;
      }

      // Handle Deepgram transcription results
      if (message.channel?.alternatives?.[0]) {
        const alternative = message.channel.alternatives[0];
        const transcript = alternative.transcript;
        
        if (transcript && transcript.trim().length > 0) {
          const transcriptData: TranscriptData = {
            text: transcript,
            is_final: message.is_final || false,
            confidence: alternative.confidence || 0,
            start: message.start,
            end: message.end,
            words: alternative.words || []
          };

          // Filter out likely hallucinations
          if (!this.isLikelyHallucination(transcript.toLowerCase())) {
            this.onTranscription(transcriptData);
          }
        }
      }

      // Handle speech started/ended events
      if (message.type === 'SpeechStarted') {
        console.log('Speech started detected');
      } else if (message.type === 'UtteranceEnd') {
        console.log('Utterance end detected');
      }

    } catch (error) {
      console.error('Error parsing Deepgram message:', error);
    }
  }

  private async startAudioCapture() {
    try {
      // Get audio stream with optimized settings for Deepgram
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create MediaRecorder with WebM format
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          // Convert blob to array buffer and send to WebSocket
          const arrayBuffer = await event.data.arrayBuffer();
          this.ws.send(arrayBuffer);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      // Start recording with small chunks for real-time streaming
      this.mediaRecorder.start(100); // Send data every 100ms
      this.isRecording = true;

    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw new Error('Could not access microphone');
    }
  }

  stopTranscription() {
    this.isRecording = false;
    
    // Stop audio recording
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Send finalize message and close WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'finalize' }));
      this.ws.close();
    }

    this.ws = null;
    this.mediaRecorder = null;
    this.onStatusChange('Stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  private isLikelyHallucination(text: string): boolean {
    // Common speech-to-text hallucinations
    const exactHallucinations = [
      'bye', 'bye-bye', 'bye bye', 'goodbye',
      'thank you', 'thanks', 'thank you very much', 
      'thank you for listening', 'thank you for joining',
      'thank you for watching', 'thank you for your time',
      'good night', 'goodnight', 'good morning', 'good afternoon',
      'thank you. bye', 'thank you. bye.', 'thanks. bye',
      'thanks. bye.', 'thank you, bye', 'thanks, bye'
    ];

    // Religious/Arabic phrases that can be hallucinated
    const religiousPatterns = [
      'bi hurmati', 'muhammad', 'al-mustafa', 'surat', 'al-fatiha', 'bismillah'
    ];

    // Check exact matches
    if (exactHallucinations.includes(text)) {
      return true;
    }

    // Check for religious patterns
    if (religiousPatterns.some(pattern => text.includes(pattern))) {
      return true;
    }

    // Filter extremely repetitive patterns
    const words = text.split(' ');
    if (words.length >= 4) {
      const uniqueWords = new Set(words.map(w => w.toLowerCase()));
      if (uniqueWords.size === 1) {
        return true;
      }
    }

    return false;
  }
}