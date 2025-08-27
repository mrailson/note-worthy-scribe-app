import { supabase } from "@/integrations/supabase/client";

export interface AmazonTranscriberConfig {
  region?: string;
  languageCode?: string;
  sampleRate?: number;
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export class AmazonTranscriber {
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private config: Required<AmazonTranscriberConfig>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(config: AmazonTranscriberConfig = {}) {
    this.config = {
      region: config.region || 'us-east-1',
      languageCode: config.languageCode || 'en-US',
      sampleRate: config.sampleRate || 16000,
      onTranscription: config.onTranscription || (() => {}),
      onError: config.onError || (() => {}),
      onConnectionChange: config.onConnectionChange || (() => {}),
    };
  }

  async connect(): Promise<void> {
    try {
      // Get WebSocket URL from our edge function
      const { data, error } = await supabase.functions.invoke('amazon-transcribe', {
        body: {
          action: 'get_websocket_url',
          region: this.config.region,
          languageCode: this.config.languageCode,
          sampleRate: this.config.sampleRate,
        },
      });

      if (error) {
        throw new Error(`Failed to get WebSocket URL: ${error.message}`);
      }

      if (!data.websocketUrl) {
        throw new Error('No WebSocket URL received');
      }

      // Connect to Amazon Transcribe WebSocket
      this.websocket = new WebSocket(data.websocketUrl);

      this.websocket.onopen = () => {
        console.log('Connected to Amazon Transcribe');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.config.onConnectionChange(true);
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleTranscribeMessage(message);
        } catch (error) {
          console.error('Error parsing transcription message:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('Amazon Transcribe WebSocket error:', error);
        this.config.onError('WebSocket connection error');
      };

      this.websocket.onclose = (event) => {
        console.log('Amazon Transcribe WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.config.onConnectionChange(false);
        
        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        }
      };

    } catch (error) {
      console.error('Error connecting to Amazon Transcribe:', error);
      this.config.onError(`Connection error: ${error.message}`);
      throw error;
    }
  }

  private handleTranscribeMessage(message: any): void {
    // Handle different types of Amazon Transcribe messages
    if (message.MessageType === 'TranscriptResultStream') {
      const transcript = message.Transcript;
      if (transcript && transcript.Results) {
        for (const result of transcript.Results) {
          if (result.Alternatives && result.Alternatives.length > 0) {
            const transcription = result.Alternatives[0].Transcript;
            if (transcription && transcription.trim()) {
              this.config.onTranscription(transcription);
            }
          }
        }
      }
    } else if (message.MessageType === 'TranscriptEvent') {
      // Handle real-time transcript events
      const transcript = message.Transcript;
      if (transcript && transcript.Results) {
        for (const result of transcript.Results) {
          if (!result.IsPartial && result.Alternatives && result.Alternatives.length > 0) {
            const transcription = result.Alternatives[0].Transcript;
            if (transcription && transcription.trim()) {
              this.config.onTranscription(transcription);
            }
          }
        }
      }
    } else if (message.MessageType === 'BadRequestException') {
      this.config.onError(`Bad request: ${message.Message}`);
    } else if (message.MessageType === 'LimitExceededException') {
      this.config.onError('Rate limit exceeded');
    } else if (message.MessageType === 'InternalsServerException') {
      this.config.onError('Internal server error');
    }
  }

  sendAudioData(audioData: ArrayBuffer): void {
    if (!this.isConnected || !this.websocket) {
      console.warn('Amazon Transcribe not connected, cannot send audio data');
      return;
    }

    try {
      // Convert audio data to the format expected by Amazon Transcribe
      // Amazon Transcribe expects specific audio event format
      const audioEvent = {
        MessageType: 'AudioEvent',
        AudioChunk: Array.from(new Uint8Array(audioData)),
      };

      this.websocket.send(JSON.stringify(audioEvent));
    } catch (error) {
      console.error('Error sending audio data:', error);
      this.config.onError('Failed to send audio data');
    }
  }

  disconnect(): void {
    if (this.websocket) {
      this.websocket.close(1000, 'User initiated disconnect');
      this.websocket = null;
    }
    this.isConnected = false;
    this.config.onConnectionChange(false);
  }

  isConnectedToService(): boolean {
    return this.isConnected;
  }

  updateConfig(newConfig: Partial<AmazonTranscriberConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Static method to check if Amazon Transcribe credentials are available
  static async isAvailable(): Promise<boolean> {
    try {
      const { data, error } = await supabase.functions.invoke('amazon-transcribe', {
        body: { action: 'check_credentials' },
      });
      return !error && data?.available === true;
    } catch {
      return false;
    }
  }

  // Static method to get supported regions
  static getSupportedRegions(): string[] {
    return [
      'us-east-1',
      'us-east-2', 
      'us-west-1',
      'us-west-2',
      'eu-west-1',
      'eu-west-2',
      'eu-central-1',
      'ap-southeast-1',
      'ap-southeast-2',
      'ap-northeast-1',
      'ap-northeast-2',
      'ca-central-1',
    ];
  }

  // Static method to get supported languages
  static getSupportedLanguages(): Record<string, string> {
    return {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'en-AU': 'English (Australia)',
      'en-IN': 'English (India)',
      'es-US': 'Spanish (US)',
      'es-ES': 'Spanish (Spain)',
      'fr-FR': 'French (France)',
      'fr-CA': 'French (Canada)',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'pt-BR': 'Portuguese (Brazil)',
      'pt-PT': 'Portuguese (Portugal)',
      'ru-RU': 'Russian',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'zh-CN': 'Chinese (Mandarin)',
      'ar-AE': 'Arabic (Gulf)',
      'ar-SA': 'Arabic (Saudi Arabia)',
      'hi-IN': 'Hindi',
      'nl-NL': 'Dutch',
      'sv-SE': 'Swedish',
      'no-NO': 'Norwegian',
      'da-DK': 'Danish',
      'fi-FI': 'Finnish',
    };
  }
}