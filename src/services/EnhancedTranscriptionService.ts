import { supabase } from "@/integrations/supabase/client";
import { EnhancedAudioCaptureService, AudioChunk, AudioCaptureCallbacks } from "./EnhancedAudioCaptureService";

export interface TranscriptionResult {
  chunkId: string;
  chunkNumber: number;
  transcript: string;
  confidence?: number;
  language?: string;
  processingTime?: number;
  skipped?: boolean;
  error?: string;
}

export interface EnhancedTranscriptionCallbacks {
  onTranscriptionResult?: (result: TranscriptionResult) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  onSessionUpdate?: (sessionInfo: any) => void;
}

export interface EnhancedTranscriptionOptions {
  meetingId: string;
  contextPrompt?: string;
  chunkDuration?: number;
  overlapDuration?: number;
  enableSystemAudio?: boolean;
  autoStart?: boolean;
}

export class EnhancedTranscriptionService {
  private audioService: EnhancedAudioCaptureService;
  private sessionId: string | null = null;
  private isTranscribing = false;
  private readonly callbacks: EnhancedTranscriptionCallbacks;
  private readonly options: Required<EnhancedTranscriptionOptions>;

  constructor(callbacks: EnhancedTranscriptionCallbacks = {}, options: EnhancedTranscriptionOptions) {
    this.callbacks = callbacks;
    this.options = {
      contextPrompt: 'This is a professional meeting transcription. Please transcribe accurately.',
      chunkDuration: 15000,
      overlapDuration: 2000,
      enableSystemAudio: false,
      autoStart: false,
      ...options
    };

    // Setup audio capture callbacks
    const audioCaptureCallbacks: AudioCaptureCallbacks = {
      onChunkReady: this.handleAudioChunk.bind(this),
      onError: this.handleAudioError.bind(this),
      onStatusChange: this.handleStatusChange.bind(this)
    };

    // Initialize audio capture service
    this.audioService = new EnhancedAudioCaptureService(audioCaptureCallbacks, {
      chunkDuration: this.options.chunkDuration,
      overlapDuration: this.options.overlapDuration,
      enableSystemAudio: this.options.enableSystemAudio
    });

    console.log('EnhancedTranscriptionService initialized for meeting:', this.options.meetingId);
  }

  async startTranscription(): Promise<void> {
    try {
      if (this.isTranscribing) {
        console.warn('Transcription already in progress');
        return;
      }

      console.log('Starting enhanced transcription service...');
      this.callbacks.onStatusChange?.('connecting');

      // Create audio session in database
      await this.createAudioSession();

      // Start audio capture
      await this.audioService.startCapture();
      
      this.isTranscribing = true;
      console.log('Enhanced transcription service started successfully');

    } catch (error) {
      console.error('Failed to start transcription service:', error);
      this.callbacks.onError?.(error as Error);
      this.callbacks.onStatusChange?.('error');
      throw error;
    }
  }

  private async createAudioSession(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('audio_sessions')
        .insert({
          meeting_id: this.options.meetingId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          status: 'active'
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to create audio session: ${error.message}`);
      }

      this.sessionId = data.id;
      console.log('Audio session created with ID:', this.sessionId);

    } catch (error) {
      console.error('Error creating audio session:', error);
      throw error;
    }
  }

  private async handleAudioChunk(chunk: AudioChunk): Promise<void> {
    try {
      console.log(`Processing transcription for chunk ${chunk.chunkNumber}`);

      // Prepare form data for transcription API
      const formData = new FormData();
      formData.append('audio', chunk.audioBlob, `chunk_${chunk.chunkNumber}.wav`);
      formData.append('meetingId', this.options.meetingId);
      formData.append('chunkNumber', chunk.chunkNumber.toString());
      formData.append('startTime', chunk.startTime.toISOString());
      formData.append('endTime', chunk.endTime.toISOString());
      formData.append('contextPrompt', this.options.contextPrompt);

      // Get authorization token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token available');
      }

      // Call enhanced transcription function
      const response = await supabase.functions.invoke('enhanced-audio-transcription', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(`Transcription API error: ${response.error.message}`);
      }

      const result: TranscriptionResult = {
        chunkId: response.data.chunkId || '',
        chunkNumber: chunk.chunkNumber,
        transcript: response.data.transcript || '',
        confidence: response.data.confidence,
        language: response.data.language,
        processingTime: response.data.processingTime,
        skipped: response.data.skipped || false
      };

      console.log(`Transcription result for chunk ${chunk.chunkNumber}:`, result.transcript);
      this.callbacks.onTranscriptionResult?.(result);

      // Update session info
      this.callbacks.onSessionUpdate?.(this.audioService.getSessionInfo());

    } catch (error) {
      console.error(`Error processing chunk ${chunk.chunkNumber}:`, error);
      
      const errorResult: TranscriptionResult = {
        chunkId: '',
        chunkNumber: chunk.chunkNumber,
        transcript: '',
        error: error.message
      };
      
      this.callbacks.onTranscriptionResult?.(errorResult);
      this.callbacks.onError?.(error as Error);
    }
  }

  private handleAudioError(error: Error): void {
    console.error('Audio capture error:', error);
    this.callbacks.onError?.(error);
  }

  private handleStatusChange(status: 'disconnected' | 'connecting' | 'connected' | 'error'): void {
    console.log('Audio capture status changed to:', status);
    this.callbacks.onStatusChange?.(status);
  }

  async stopTranscription(): Promise<void> {
    try {
      console.log('Stopping enhanced transcription service...');
      
      this.isTranscribing = false;
      
      // Stop audio capture
      this.audioService.stopCapture();
      
      // Update session status
      if (this.sessionId) {
        await supabase
          .from('audio_sessions')
          .update({ 
            status: 'completed',
            session_end: new Date().toISOString()
          })
          .eq('id', this.sessionId);
      }
      
      this.callbacks.onStatusChange?.('disconnected');
      console.log('Enhanced transcription service stopped');
      
    } catch (error) {
      console.error('Error stopping transcription service:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  async pauseTranscription(): Promise<void> {
    if (this.sessionId) {
      await supabase
        .from('audio_sessions')
        .update({ status: 'paused' })
        .eq('id', this.sessionId);
    }
    
    this.audioService.stopCapture();
    this.callbacks.onStatusChange?.('disconnected');
  }

  async resumeTranscription(): Promise<void> {
    if (this.sessionId) {
      await supabase
        .from('audio_sessions')
        .update({ status: 'active' })
        .eq('id', this.sessionId);
    }
    
    await this.audioService.startCapture();
  }

  isActive(): boolean {
    return this.isTranscribing && this.audioService.isActive();
  }

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      meetingId: this.options.meetingId,
      isTranscribing: this.isTranscribing,
      audioService: this.audioService.getSessionInfo(),
      options: this.options
    };
  }

  async getCombinedTranscript(): Promise<string> {
    try {
      const { data, error } = await supabase
        .rpc('get_meeting_transcript', { p_meeting_id: this.options.meetingId });

      if (error) {
        throw new Error(`Failed to get combined transcript: ${error.message}`);
      }

      return data || '';
    } catch (error) {
      console.error('Error getting combined transcript:', error);
      return '';
    }
  }

  async getTranscriptionChunks() {
    try {
      const { data, error } = await supabase
        .from('transcription_chunks')
        .select('*')
        .eq('meeting_id', this.options.meetingId)
        .order('chunk_number');

      if (error) {
        throw new Error(`Failed to get transcription chunks: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error getting transcription chunks:', error);
      return [];
    }
  }
}