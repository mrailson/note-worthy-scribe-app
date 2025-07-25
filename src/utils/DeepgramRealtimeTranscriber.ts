import { SystemAudioCapture } from '@/utils/SystemAudioCapture';
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
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private isRecording = false;
  private sessionId: string = '';
  private audioCapture: SystemAudioCapture;
  private pollingInterval: number | null = null;
  private audioChunks: Blob[] = [];

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.audioCapture = new SystemAudioCapture();
  }

  async startTranscription() {
    try {
      this.onStatusChange('Connecting...');
      console.log('🚀 Starting HTTP polling transcription...');
      await this.startAudioCapture();
      this.startPolling();
      this.onStatusChange('Recording');
    } catch (error) {
      console.error('Error starting transcription:', error);
      this.onError(`Failed to start transcription: ${error}`);
    }
  }

  private startPolling() {
    // Start polling every 2 seconds to send accumulated audio
    this.pollingInterval = window.setInterval(async () => {
      if (this.audioChunks.length > 0) {
        await this.sendAudioChunkForTranscription();
      }
    }, 2000);
  }

  private async sendAudioChunkForTranscription() {
    if (this.audioChunks.length === 0) return;

    try {
      // Combine all audio chunks into one blob
      const combinedBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
      console.log('📤 Sending audio chunk for transcription:', combinedBlob.size, 'bytes');

      // Clear the chunks after combining
      this.audioChunks = [];

      // Create form data
      const formData = new FormData();
      formData.append('audio', combinedBlob, 'audio.webm');

      // Send to our HTTP transcription edge function
      const { data, error } = await supabase.functions.invoke('deepgram-http-transcription', {
        body: formData,
      });

      if (error) {
        console.error('❌ Transcription request error:', error);
        return;
      }

      if (data?.success && data.transcript?.trim()) {
        console.log('✅ Received transcription:', data.transcript);
        
        const transcriptData: TranscriptData = {
          text: data.transcript,
          is_final: data.is_final || true,
          confidence: data.confidence || 0,
          words: data.words || [],
          speaker: 'Speaker 1' // HTTP mode doesn't have real-time speaker detection
        };

        // Filter out likely hallucinations
        if (!this.isLikelyHallucination(data.transcript.toLowerCase())) {
          this.onTranscription(transcriptData);
          
          // Send to summarizer
          this.sendToSummarizer(data.transcript);
        }
      }

    } catch (error) {
      console.error('❌ Error sending audio for transcription:', error);
    }
  }

  private async startAudioCapture() {
    try {
      // Always try to capture both mic + system audio
      this.mediaStream = await this.audioCapture.startCapture();

      // Create MediaRecorder with WebM format
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Store audio chunks for HTTP transmission
          this.audioChunks.push(event.data);
          console.log('🎵 Audio chunk received:', event.data.size, 'bytes');
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.onError('Recording error occurred');
      };

      // Start recording with chunks every 1 second
      this.mediaRecorder.start(1000);
      this.isRecording = true;

    } catch (error) {
      console.error('Error starting audio capture:', error);
      throw new Error('Could not access microphone');
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping HTTP polling transcription...');
    this.isRecording = false;
    
    // Stop polling
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Send any remaining audio chunks
    if (this.audioChunks.length > 0) {
      this.sendAudioChunkForTranscription();
    }
    
    // Stop audio recording
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    // Stop audio capture
    this.audioCapture.stopCapture();
    this.mediaStream = null;
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

  private async sendToSummarizer(text: string) {
    try {
      const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/realtime-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          text: text,
          action: 'add'
        }),
      });

      const data = await response.json();
      
      if (data.success && data.action === 'summary_generated' && this.onSummary) {
        this.onSummary(data.summary);
      }
    } catch (error) {
      console.error('Error sending to summarizer:', error);
    }
  }

  async clearSummary() {
    try {
      await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/realtime-summarizer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          action: 'clear'
        }),
      });
    } catch (error) {
      console.error('Error clearing summary:', error);
    }
  }
}