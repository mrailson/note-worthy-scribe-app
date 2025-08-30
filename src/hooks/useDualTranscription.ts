import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AssemblyAIRealtimeTranscriber, TranscriptData } from '@/utils/AssemblyAIRealtimeTranscriber';
import { WhisperTranscriber } from '@/utils/WhisperTranscriber';
import { useToast } from '@/components/ui/use-toast';
import { mergeLive, LiveChunk } from '@/utils/liveMerge';

export interface DualTranscriptionState {
  isRecording: boolean;
  assemblyStatus: string;
  whisperStatus: string;
  assemblyTranscript: string;
  whisperTranscript: string;
  assemblyConfidence: number;
  whisperConfidence: number;
  assemblyEnabled: boolean;
  whisperEnabled: boolean;
  primarySource: 'assembly' | 'whisper';
  assemblyChunks: LiveChunk[];
  whisperChunks: LiveChunk[];
  assemblyWordCount: number;
  whisperWordCount: number;
}

export const useDualTranscription = (meetingId?: string, sessionId?: string) => {
  const { toast } = useToast();
  const [state, setState] = useState<DualTranscriptionState>({
    isRecording: false,
    assemblyStatus: 'idle',
    whisperStatus: 'idle',
    assemblyTranscript: '',
    whisperTranscript: '',
    assemblyConfidence: 0,
    whisperConfidence: 0,
    assemblyEnabled: true,
    whisperEnabled: true,
    primarySource: 'whisper',
    assemblyChunks: [],
    whisperChunks: [],
    assemblyWordCount: 0,
    whisperWordCount: 0
  });

  const assemblyTranscriberRef = useRef<AssemblyAIRealtimeTranscriber | null>(null);
  const whisperTranscriberRef = useRef<WhisperTranscriber | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);

  const updateState = useCallback((updates: Partial<DualTranscriptionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const saveAssemblyTranscript = useCallback(async (
    transcript: string, 
    confidence: number, 
    isFinal: boolean = false
  ) => {
    if (!meetingId || !sessionId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('assembly_transcripts').insert({
        meeting_id: meetingId,
        user_id: user.id,
        session_id: sessionId,
        chunk_index: chunkIndexRef.current++,
        transcript_text: transcript,
        confidence,
        is_final: isFinal,
        timestamp_ms: Date.now()
      });
    } catch (error) {
      console.error('Error saving Assembly transcript:', error);
    }
  }, [meetingId, sessionId]);

  const resetState = useCallback(() => {
    setState({
      isRecording: false,
      assemblyStatus: 'idle',
      whisperStatus: 'idle',
      assemblyTranscript: '',
      whisperTranscript: '',
      assemblyConfidence: 0,
      whisperConfidence: 0,
      assemblyEnabled: true,
      whisperEnabled: true,
      primarySource: 'whisper',
      assemblyChunks: [],
      whisperChunks: [],
      assemblyWordCount: 0,
      whisperWordCount: 0
    });
  }, []);

  const startDualTranscription = useCallback(async () => {
    try {
      updateState({ isRecording: true });

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // Initialize Assembly AI transcriber if enabled
      if (state.assemblyEnabled) {
        assemblyTranscriberRef.current = new AssemblyAIRealtimeTranscriber(
          (data: TranscriptData) => {
            // Create LiveChunk from TranscriptData
            const chunk: LiveChunk = {
              text: data.text,
              isFinal: data.is_final,
              seq: Date.now(),
              start_ms: data.start ? data.start * 1000 : undefined,
              end_ms: data.end ? data.end * 1000 : undefined,
              source: 'assembly'
            };

            setState(prev => {
              // Add chunk to history
              const newChunks = [...prev.assemblyChunks, chunk];
              
              // Accumulate transcript using mergeLive
              const newTranscript = mergeLive(prev.assemblyTranscript, chunk);
              const wordCount = newTranscript.trim().split(/\s+/).filter(w => w.length > 0).length;
              
              return {
                ...prev,
                assemblyTranscript: newTranscript,
                assemblyConfidence: data.confidence,
                assemblyChunks: newChunks.slice(-50), // Keep last 50 chunks
                assemblyWordCount: wordCount
              };
            });
            
            // Save to database
            if (data.is_final) {
              saveAssemblyTranscript(data.text, data.confidence, true);
            }
          },
          (error: string) => {
            console.error('Assembly AI error:', error);
            updateState({ assemblyStatus: 'error' });
            toast({
              title: "Assembly AI Error",
              description: error,
              variant: "destructive"
            });
          },
          (status: string) => {
            updateState({ assemblyStatus: status });
          }
        );

        updateState({ assemblyStatus: 'connecting' });
        await assemblyTranscriberRef.current.startTranscription();
        updateState({ assemblyStatus: 'connected' });
      }

      // Initialize Whisper transcriber if enabled
      if (state.whisperEnabled) {
        whisperTranscriberRef.current = new WhisperTranscriber(
          "https://dphcnbricafkbtizkoal.supabase.co/functions/v1/assemblyai-transcription",
          (payload: any) => {
            if (payload.text) {
              // Create LiveChunk from Whisper payload
              const chunk: LiveChunk = {
                text: payload.text,
                isFinal: true, // Whisper chunks are typically final
                seq: Date.now(),
                source: 'whisper'
              };

              setState(prev => {
                // Add chunk to history
                const newChunks = [...prev.whisperChunks, chunk];
                
                // Accumulate transcript using mergeLive
                const newTranscript = mergeLive(prev.whisperTranscript, chunk);
                const wordCount = newTranscript.trim().split(/\s+/).filter(w => w.length > 0).length;
                
                return {
                  ...prev,
                  whisperTranscript: newTranscript,
                  whisperConfidence: payload.confidence || 0.9,
                  whisperChunks: newChunks.slice(-50), // Keep last 50 chunks
                  whisperWordCount: wordCount
                };
              });
            }
          },
          (error: string) => {
            console.error('Whisper error:', error);
            updateState({ whisperStatus: 'error' });
            toast({
              title: "Whisper Error", 
              description: error,
              variant: "destructive"
            });
          },
          (status: string) => {
            updateState({ whisperStatus: status });
          }
        );

        updateState({ whisperStatus: 'starting' });
        await whisperTranscriberRef.current.startTranscription();
        updateState({ whisperStatus: 'recording' });
      }

      // Set up MediaRecorder for Whisper chunks
      if (state.whisperEnabled && whisperTranscriberRef.current) {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && whisperTranscriberRef.current) {
            whisperTranscriberRef.current.enqueueChunk(event.data);
          }
        };

        mediaRecorder.start(2000); // Collect data every 2 seconds
      }

      toast({
        title: "Dual Transcription Started",
        description: `Recording with ${state.assemblyEnabled ? 'Assembly AI' : ''}${state.assemblyEnabled && state.whisperEnabled ? ' and ' : ''}${state.whisperEnabled ? 'Whisper' : ''}`,
      });

    } catch (error) {
      console.error('Error starting dual transcription:', error);
      updateState({ isRecording: false });
      toast({
        title: "Error",
        description: "Failed to start transcription services",
        variant: "destructive"
      });
    }
  }, [state.assemblyEnabled, state.whisperEnabled, saveAssemblyTranscript, updateState, toast]);

  const stopDualTranscription = useCallback(async () => {
    try {
      updateState({ isRecording: false });

      // Stop Assembly AI
      if (assemblyTranscriberRef.current) {
        assemblyTranscriberRef.current.stopTranscription();
        assemblyTranscriberRef.current = null;
        updateState({ assemblyStatus: 'stopped' });
      }

      // Stop Whisper
      if (whisperTranscriberRef.current) {
        whisperTranscriberRef.current.stopTranscription();
        whisperTranscriberRef.current = null;
        updateState({ whisperStatus: 'stopped' });
      }

      // Stop MediaRecorder and stream
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Save final transcripts to meeting
      if (meetingId) {
        await supabase.from('meetings').update({
          assembly_transcript_text: state.assemblyTranscript,
          whisper_transcript_text: state.whisperTranscript,
          assembly_confidence: state.assemblyConfidence,
          whisper_confidence: state.whisperConfidence,
          primary_transcript_source: state.primarySource
        }).eq('id', meetingId);
      }

      toast({
        title: "Transcription Stopped",
        description: "Both transcription services have been stopped and saved",
      });

    } catch (error) {
      console.error('Error stopping transcription:', error);
      toast({
        title: "Error",
        description: "Error stopping transcription services",
        variant: "destructive"
      });
    }
  }, [meetingId, state.assemblyTranscript, state.whisperTranscript, state.assemblyConfidence, state.whisperConfidence, state.primarySource, updateState, toast]);

  const toggleService = useCallback((service: 'assembly' | 'whisper') => {
    if (state.isRecording) {
      toast({
        title: "Cannot Change Services",
        description: "Stop recording before changing transcription services",
        variant: "destructive"
      });
      return;
    }

    if (service === 'assembly') {
      updateState({ assemblyEnabled: !state.assemblyEnabled });
    } else {
      updateState({ whisperEnabled: !state.whisperEnabled });
    }
  }, [state.isRecording, state.assemblyEnabled, state.whisperEnabled, updateState, toast]);

  const setPrimarySource = useCallback((source: 'assembly' | 'whisper') => {
    updateState({ primarySource: source });
  }, [updateState]);

  return {
    state,
    startDualTranscription,
    stopDualTranscription,
    toggleService,
    setPrimarySource,
    resetState
  };
};