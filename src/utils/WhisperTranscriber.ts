import { supabase } from "@/integrations/supabase/client";

export interface TranscriptData {
  text: string;
  is_final: boolean;
  confidence: number;
  start?: number;
  end?: number;
  speaker?: string;
}

export class WhisperTranscriber {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isRecording = false;
  private chunkTimer: number | undefined = undefined;
  private uploadQueue: Promise<void> = Promise.resolve();
  private audioChunks: Blob[] = [];
  private chunkCounter = 0;
  private networkRetryCount = 0;
  private maxNetworkRetries = 3;

  constructor(
    private onTranscription: (data: TranscriptData) => void,
    private onError: (error: string) => void,
    private onStatusChange: (status: string) => void,
    private onSummary?: (summary: string) => void
  ) {}

  async startTranscription() {
    if (this.isRecording) {
      console.warn("🎙️ Recorder already running; ignoring start.");
      return;
    }

    try {
      console.log('🎙️ Starting API-based Whisper transcription...');
      this.onStatusChange('Starting recording...');

      console.log('🎤 Requesting microphone access...');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,              // mono is best for STT
          sampleRate: 48000,            // browsers usually give 48 kHz; Whisper will resample
          noiseSuppression: true,       // useful for live mic
          echoCancellation: true,       // true if mic + speakers
          autoGainControl: false        // avoid volume pumping; let Whisper handle dynamics
        }
      });
      console.log('✅ Microphone access granted');

      console.log('🔧 Creating MediaRecorder...');
      // Use known-good settings for Whisper
      const mimeType = 'audio/webm;codecs=opus'; // Whisper accepts webm/opus
      
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error(`MediaRecorder does not support ${mimeType}`);
      }
      
      console.log('🎵 Using MediaRecorder mimeType:', mimeType);
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000 // ~128 kbps VBR is a good balance
      });

      this.mediaRecorder.ondataavailable = async (e) => {
        console.log('📡 MediaRecorder data available:', {
          hasData: !!e.data,
          dataSize: e.data?.size || 0,
          timestamp: new Date().toISOString(),
          chunkNumber: this.chunkCounter++
        });
        
        if (e.data && e.data.size > 0) {
          // Collect chunks instead of processing individually
          this.audioChunks.push(e.data);
          
          // Process accumulated audio every few chunks or when we have enough data
          if (this.audioChunks.length >= 1) { // Process each chunk individually but as complete WebM
            await this.processAccumulatedAudio();
          }
        } else {
          console.warn('⚠️ No audio data available in chunk');
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped');
        // Process any remaining chunks when recording stops
        if (this.audioChunks.length > 0) {
          this.processAccumulatedAudio();
        }
        this.isRecording = false;
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        this.onError('MediaRecorder error occurred');
      };

      this.isRecording = true;
      console.log('▶️ Starting MediaRecorder...');
      this.mediaRecorder.start(5000); // 5-second chunks for better WebM structure
      
      this.onStatusChange('Recording');
      console.log('✅ API-based Whisper transcription started successfully');
    } catch (error) {
      console.error('❌ Failed to start Whisper transcription:', error);
      this.onError(`Failed to start Whisper: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.onStatusChange('Error');
    }
  }

  private async processAccumulatedAudio() {
    if (this.audioChunks.length === 0) return;
    
    // Take the latest chunk (which should be a complete WebM segment)
    const latestChunk = this.audioChunks.pop()!;
    this.audioChunks = []; // Clear the buffer
    
    // Process the complete chunk
    await this.uploadChunk(latestChunk);
  }

  private async uploadChunk(audioData: Blob) {
    // Queue uploads to prevent concurrent requests that cause 500 errors
    this.uploadQueue = this.uploadQueue.then(() => this.processChunkWithRetry(audioData));
    return this.uploadQueue;
  }

  private async processChunkWithRetry(audioData: Blob, maxRetries = 3) {
    let delay = 300;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.processChunk(audioData);
        this.networkRetryCount = 0; // Reset network retry count on success
        return; // Success - exit retry loop
      } catch (error) {
        console.warn(`❌ Upload attempt ${attempt}/${maxRetries} failed:`, error);
        
        // Check if it's a network error
        const isNetworkError = error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('ERR_NETWORK') ||
          error.message.includes('ERR_INTERNET_DISCONNECTED')
        );
        
        if (isNetworkError) {
          this.networkRetryCount++;
          this.onStatusChange(`Network issue detected (${this.networkRetryCount}/${this.maxNetworkRetries})`);
          
          if (this.networkRetryCount >= this.maxNetworkRetries) {
            console.error('❌ Max network retries reached. Stopping transcription.');
            this.onError(`Network connectivity lost. Tried ${this.maxNetworkRetries} times.`);
            this.stopTranscription();
            return;
          }
        }
        
        if (attempt === maxRetries) {
          console.error('❌ All retry attempts failed');
          this.onError(`Upload failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  private async processChunk(audioData: Blob) {
    try {
      console.log('🔄 [v7-DIAGNOSTIC] Processing audio chunk with binary upload...');
      console.log('📊 Audio chunk details:', {
        size: audioData.size,
        type: audioData.type,
        sizeInKB: Math.round(audioData.size / 1024),
        timestamp: new Date().toISOString()
      });
      
      this.onStatusChange('Processing...');
      
      // Skip very small chunks
      if (audioData.size < 1000) {
        console.log('🔇 Skipping very small audio chunk, size:', audioData.size);
        this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
        return;
      }

      console.log('📤 [DIAGNOSTIC] Preparing to send binary audio data...');
      
      // Add network connectivity check
      if (!navigator.onLine) {
        console.error('❌ [DIAGNOSTIC] No internet connection available');
        throw new Error('No internet connection available');
      }
      
      console.log('🌐 [DIAGNOSTIC] Network connectivity confirmed');
      
      // Send binary data directly for maximum efficiency
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error('⏰ [DIAGNOSTIC] Request timed out after 30 seconds');
        controller.abort();
      }, 30000);
      
      const requestUrl = `https://dphcnbricafkbtizkoal.supabase.co/functions/v1/speech-to-text`;
      
      // Get the current session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs';
      
      const requestHeaders = {
        'content-type': 'application/octet-stream',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs',
        'authorization': `Bearer ${authToken}`
      };
      
      console.log('🚀 [DIAGNOSTIC] Sending POST request:', {
        url: requestUrl,
        method: 'POST',
        headers: requestHeaders,
        bodySize: audioData.size,
        bodyType: audioData.type,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: audioData, // Send Blob directly
        signal: controller.signal,
        keepalive: false, // Disabled to prevent hanging requests
      });
      
      clearTimeout(timeoutId);
      
      console.log('📥 [DIAGNOSTIC] Received response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url,
        timestamp: new Date().toISOString()
      });

      // Enhanced error handling with detailed error information
      const responseText = await response.text();
      let data: any;
      
      console.log('📄 [DIAGNOSTIC] Raw response text:', {
        length: responseText.length,
        content: responseText.substring(0, 500), // First 500 chars
        timestamp: new Date().toISOString()
      });
      
      try { 
        data = JSON.parse(responseText); 
        console.log('✅ [DIAGNOSTIC] Successfully parsed JSON response');
      } catch (parseError) { 
        console.error('❌ [DIAGNOSTIC] Failed to parse JSON response:', parseError);
        data = { error: responseText }; 
      }

      console.log('📨 [DIAGNOSTIC] Processed response data:', { 
        status: response.status,
        ok: response.ok,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        errorMessage: data?.error || 'No error message',
        responseSize: responseText.length,
        timestamp: new Date().toISOString()
      });

      if (!response.ok) {
        const errorDetail = data?.detail || data?.error || responseText || `STT ${response.status}`;
        console.error('❌ Speech-to-text error details:', {
          status: response.status,
          statusText: response.statusText,
          error: data?.error,
          detail: data?.detail,
          responseText: responseText.substring(0, 200)
        });
        
        // Check for specific network/server errors that should trigger reconnection
        if (response.status >= 500 || response.status === 0) {
          throw new Error(`Server error: ${errorDetail}`);
        } else {
          throw new Error(`Transcription failed: ${errorDetail}`);
        }
      }

      if (data?.text && data.text.trim()) {
        const cleanText = data.text.trim();
        console.log('📝 Whisper transcription SUCCESS:', cleanText);
        
        const transcriptData: TranscriptData = {
          text: cleanText,
          is_final: true,
          confidence: data.confidence || 0.9,
          speaker: 'Speaker'
        };
        
        console.log('✅ Calling onTranscription with:', transcriptData);
        this.onTranscription(transcriptData);
        
        if (this.onSummary) {
          this.onSummary(cleanText);
        }
      } else {
        console.log('ℹ️ No transcript text received. Full response:', JSON.stringify(data, null, 2));
      }
      
      this.onStatusChange(this.isRecording ? 'Recording' : 'Stopped');
    } catch (error) {
      console.error('❌ [DIAGNOSTIC] Whisper processing error details:', {
        error: error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        name: error instanceof Error ? error.name : 'Unknown error type',
        isAbortError: error instanceof Error && error.name === 'AbortError',
        isNetworkError: error instanceof TypeError,
        timestamp: new Date().toISOString()
      });
      
      // Enhanced error classification
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('🚫 [DIAGNOSTIC] Request was aborted (timeout or manual cancellation)');
        } else if (error instanceof TypeError) {
          console.error('🌐 [DIAGNOSTIC] Network error - likely connectivity issue');
        } else if (error.message.includes('Failed to fetch')) {
          console.error('📡 [DIAGNOSTIC] Fetch failed - could be CORS, network, or server issue');
        }
      }
      
      // Re-throw error so retry logic can handle it
      throw error;
    }
  }

  stopTranscription() {
    console.log('🛑 Stopping Whisper transcription...');
    
    this.isRecording = false;
    
    // Process any remaining audio chunks
    if (this.audioChunks.length > 0) {
      this.processAccumulatedAudio();
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
    
    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    this.mediaRecorder = null;
    this.stream = null;
    this.audioChunks = [];
    this.chunkCounter = 0;
    
    this.onStatusChange('Stopped');
    console.log('✅ Whisper transcription stopped');
  }

  isActive(): boolean {
    return this.isRecording;
  }

  async clearSummary() {
    console.log('🧹 Clearing Whisper summary');
  }
}