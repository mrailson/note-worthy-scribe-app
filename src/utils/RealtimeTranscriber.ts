export class RealtimeTranscriber {
  private socket: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;

  constructor(
    private onTranscript: (transcript: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void
  ) {}

  async startTranscription() {
    try {
      this.onStatusChange('Connecting...');
      
      // Connect to our Supabase Edge Function WebSocket
      const wsUrl = `wss://dphcnbricafkbtizkoal.functions.supabase.co/assemblyai-transcription`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        console.log('Connected to transcription service');
        this.onStatusChange('Connected');
        this.startAudioCapture();
      };

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data);

        switch (data.type) {
          case 'session_started':
            this.onStatusChange('Transcription active');
            break;
          case 'transcript':
          case 'partial_transcript':
            this.onTranscript({
              text: data.text,
              speaker: data.speaker,
              confidence: data.confidence,
              timestamp: data.timestamp,
              isFinal: data.is_final,
              words: data.words
            });
            break;
          case 'error':
            this.onError(data.message);
            break;
          case 'session_ended':
            this.onStatusChange('Session ended');
            break;
        }
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError('Connection error');
      };

      this.socket.onclose = () => {
        console.log('WebSocket closed');
        this.onStatusChange('Disconnected');
      };

    } catch (error) {
      console.error('Failed to start transcription:', error);
      this.onError('Failed to start transcription');
    }
  }

  private async startAudioCapture() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create AudioContext for processing raw audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(this.stream);
      
      // Create a ScriptProcessor to get raw audio data
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (this.socket?.readyState === WebSocket.OPEN && this.isRecording) {
          const inputBuffer = event.inputBuffer;
          const inputData = inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array (PCM 16-bit)
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const sample = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
          }
          
          // Convert to base64
          const buffer = new ArrayBuffer(pcmData.length * 2);
          const view = new DataView(buffer);
          for (let i = 0; i < pcmData.length; i++) {
            view.setInt16(i * 2, pcmData[i], true);
          }
          
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(buffer)));
          
          this.socket.send(JSON.stringify({
            type: 'audio_data',
            audio_data: base64Data
          }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      
      this.isRecording = true;

      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'start_transcription' }));
      }

    } catch (error) {
      console.error('Failed to start audio capture:', error);
      this.onError('Microphone access denied');
    }
  }

  stopTranscription() {
    this.isRecording = false;
    this.onStatusChange('Stopping...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'stop_transcription' }));
      this.socket.close();
    }

    this.socket = null;
    this.mediaRecorder = null;
    this.onStatusChange('Stopped');
  }

  isActive() {
    return this.isRecording && this.socket?.readyState === WebSocket.OPEN;
  }
}

export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}