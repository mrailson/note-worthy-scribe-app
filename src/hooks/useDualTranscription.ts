import { useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AssemblyAIRealtimeTranscriber, TranscriptData } from '@/utils/AssemblyAIRealtimeTranscriber';
import { WhisperTranscriber } from '@/utils/WhisperTranscriber';
import { showShadcnToast } from '@/utils/toastWrapper';
import { mergeLive, LiveChunk } from '@/utils/liveMerge';
import { 
  mergeBestOfBoth, 
  RawChunk, 
  NormChunk, 
  MergeResult,
  DEFAULT_MERGE_CONFIG 
} from '@/utils/BestOfBothMerger';

export interface DualTranscriptionState {
  isRecording: boolean;
  assemblyStatus: string;
  whisperStatus: string;
  assemblyTranscript: string;
  whisperTranscript: string;
  mergedTranscript: string;  // NEW: Best-of-both merged transcript
  assemblyConfidence: number;
  whisperConfidence: number;
  assemblyEnabled: boolean;
  whisperEnabled: boolean;
  primarySource: 'assembly' | 'whisper' | 'merged';  // Added 'merged' option
  assemblyChunks: LiveChunk[];
  whisperChunks: LiveChunk[];
  assemblyRawChunks: RawChunk[];  // NEW: For merger
  whisperRawChunks: RawChunk[];   // NEW: For merger
  assemblyWordCount: number;
  whisperWordCount: number;
  mergedWordCount: number;        // NEW: Merged transcript word count
  mergeStats?: MergeResult['stats']; // NEW: Merge audit stats
  keptChunks?: NormChunk[];       // NEW: For debug panel
  droppedChunks?: NormChunk[];    // NEW: For debug panel
}

export const useDualTranscription = (meetingId?: string, sessionId?: string) => {
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(meetingId || null);
  const [state, setState] = useState<DualTranscriptionState>({
    isRecording: false,
    assemblyStatus: 'idle',
    whisperStatus: 'idle',
    assemblyTranscript: '',
    whisperTranscript: '',
    mergedTranscript: '',
    assemblyConfidence: 0,
    whisperConfidence: 0,
    assemblyEnabled: true,
    whisperEnabled: true,
    primarySource: 'merged',  // Default to merged view
    assemblyChunks: [],
    whisperChunks: [],
    assemblyRawChunks: [],
    whisperRawChunks: [],
    assemblyWordCount: 0,
    whisperWordCount: 0,
    mergedWordCount: 0
  });

  const assemblyTranscriberRef = useRef<AssemblyAIRealtimeTranscriber | null>(null);
  const whisperTranscriberRef = useRef<WhisperTranscriber | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const assemblyChunkIndexRef = useRef(0);  // NEW: Separate counter for assembly chunks
  const whisperChunkIndexRef = useRef(0);   // NEW: Separate counter for whisper chunks
  const prevAssemblyTranscriptRef = useRef(''); // Track previous transcript for delta calculation

  const updateState = useCallback((updates: Partial<DualTranscriptionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const saveTranscriptChunk = useCallback(async (
    transcript: string, 
    confidence: number, 
    isFinal: boolean = false,
    source: 'assembly' | 'whisper' = 'assembly'
  ) => {
    if (!currentMeetingId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Save to meeting_transcription_chunks for word count tracking
      await supabase.from('meeting_transcription_chunks').insert({
        meeting_id: currentMeetingId,
        user_id: user.id,
        session_id: sessionId || `session_${Date.now()}`,
        chunk_number: chunkIndexRef.current++,
        transcription_text: transcript,
        confidence_score: confidence,
        is_final: isFinal,
        source: source
      });

      // Update meeting word count
      const wordCount = transcript.split(/\s+/).filter(w => w.length > 0).length;
      console.log('📝 Updating meeting word count:', wordCount, 'for meeting:', currentMeetingId);
      await supabase.from('meetings').update({
        word_count: wordCount
      }).eq('id', currentMeetingId);

    } catch (error) {
      console.error('Error saving transcript chunk:', error);
    }
  }, [currentMeetingId, sessionId]);

  // Function to perform live merge using BestOfBothMerger
  const performLiveMerge = useCallback((
    assemblyRawChunks: RawChunk[],
    whisperRawChunks: RawChunk[]
  ): { transcript: string; wordCount: number; stats: MergeResult['stats']; kept: NormChunk[]; dropped: NormChunk[] } => {
    if (assemblyRawChunks.length === 0 && whisperRawChunks.length === 0) {
      return { 
        transcript: '', 
        wordCount: 0, 
        stats: { whisperChunks: 0, assemblyChunks: 0, keptCount: 0, droppedCount: 0, overlapConflicts: 0, bufferedDrops: 0 },
        kept: [],
        dropped: []
      };
    }

    const result = mergeBestOfBoth(whisperRawChunks, assemblyRawChunks, DEFAULT_MERGE_CONFIG);
    const wordCount = result.transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    return {
      transcript: result.transcript,
      wordCount,
      stats: result.stats,
      kept: result.kept,
      dropped: result.dropped
    };
  }, []);

  const resetState = useCallback(() => {
    chunkIndexRef.current = 0;
    assemblyChunkIndexRef.current = 0;
    whisperChunkIndexRef.current = 0;
    prevAssemblyTranscriptRef.current = '';
    
    setState({
      isRecording: false,
      assemblyStatus: 'idle',
      whisperStatus: 'idle',
      assemblyTranscript: '',
      whisperTranscript: '',
      mergedTranscript: '',
      assemblyConfidence: 0,
      whisperConfidence: 0,
      assemblyEnabled: true,
      whisperEnabled: true,
      primarySource: 'merged',
      assemblyChunks: [],
      whisperChunks: [],
      assemblyRawChunks: [],
      whisperRawChunks: [],
      assemblyWordCount: 0,
      whisperWordCount: 0,
      mergedWordCount: 0,
      mergeStats: undefined,
      keptChunks: undefined,
      droppedChunks: undefined
    });
  }, []);

  const startDualTranscription = useCallback(async () => {
    try {
      updateState({ isRecording: true });

      // Create meeting if not provided
      if (!currentMeetingId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('User not authenticated');
        }

        const { data: meeting, error: meetingError } = await supabase
          .from('meetings')
          .insert({
            title: `Dual Transcription Session - ${new Date().toLocaleString()}`,
            user_id: user.id,
            status: 'recording',
            start_time: new Date().toISOString()
          })
          .select('id')
          .single();

        if (meetingError || !meeting) {
          throw new Error('Failed to create meeting');
        }

        setCurrentMeetingId(meeting.id);
      }

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

            // Create RawChunk for BestOfBoth merger
            const rawChunk: RawChunk = {
              engine: 'assembly',
              idx: assemblyChunkIndexRef.current++,
              text: data.text,
              confidence: data.confidence,
              startSec: data.start,
              endSec: data.end
            };

            setState(prev => {
              // Add chunk to history
              const newChunks = [...prev.assemblyChunks, chunk];
              const newRawChunks = [...prev.assemblyRawChunks, rawChunk];
              
              // Accumulate transcript using mergeLive
              const mergeResult = mergeLive(prev.assemblyTranscript, chunk);
              const wordCount = mergeResult.text.trim().split(/\s+/).filter(w => w.length > 0).length;
              
              // Perform live best-of-both merge
              const bestOfBothResult = performLiveMerge(newRawChunks, prev.whisperRawChunks);
              
              return {
                ...prev,
                assemblyTranscript: mergeResult.text,
                assemblyConfidence: data.confidence,
                assemblyChunks: newChunks.slice(-50), // Keep last 50 chunks
                assemblyRawChunks: newRawChunks.slice(-100), // Keep last 100 raw chunks for merger
                assemblyWordCount: wordCount,
                mergedTranscript: bestOfBothResult.transcript,
                mergedWordCount: bestOfBothResult.wordCount,
                mergeStats: bestOfBothResult.stats,
                keptChunks: bestOfBothResult.kept,
                droppedChunks: bestOfBothResult.dropped
              };
            });
            
            // Save to database - ONLY DELTA when final
            if (data.is_final) {
              // Calculate delta: what's new since last save
              setState(prev => {
                const delta = prev.assemblyTranscript.slice(prevAssemblyTranscriptRef.current.length).trim();
                
                if (delta.length > 0) {
                  console.log(`💾 Assembly delta: ${delta.length} chars (prev: ${prevAssemblyTranscriptRef.current.length}, current: ${prev.assemblyTranscript.length})`);
                  saveTranscriptChunk(delta, data.confidence, true, 'assembly');
                  prevAssemblyTranscriptRef.current = prev.assemblyTranscript;
                } else {
                  console.log('⏭️ Skipping Assembly save - no new content');
                }
                
                return prev;
              });
            }
          },
          (error: string) => {
            console.error('Assembly AI error:', error);
            updateState({ assemblyStatus: 'error' });
            showShadcnToast({
              title: "Assembly AI Error",
              description: error,
              variant: "destructive",
              section: 'meeting_manager'
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
          "https://dphcnbricafkbtizkoal.supabase.co/functions/v1/speech-to-text",
          (payload: any) => {
            if (payload.text) {
              // Create LiveChunk from Whisper payload
              const chunk: LiveChunk = {
                text: payload.text,
                isFinal: true, // Whisper chunks are typically final
                seq: Date.now(),
                source: 'whisper'
              };

              // Create RawChunk for BestOfBoth merger
              const rawChunk: RawChunk = {
                engine: 'whisper',
                idx: whisperChunkIndexRef.current++,
                text: payload.text,
                confidence: payload.confidence || 0.9
              };

              setState(prev => {
                // Add chunk to history
                const newChunks = [...prev.whisperChunks, chunk];
                const newRawChunks = [...prev.whisperRawChunks, rawChunk];
                
                // WhisperTranscriber already handles segment merging internally - use the merged text directly
                const newTranscript = payload.data?.text || '';
                const wordCount = newTranscript.trim().split(/\s+/).filter(w => w.length > 0).length;
                
                // Perform live best-of-both merge
                const bestOfBothResult = performLiveMerge(prev.assemblyRawChunks, newRawChunks);
                
                return {
                  ...prev,
                  whisperTranscript: newTranscript,
                  whisperConfidence: payload.confidence || 0.9,
                  whisperChunks: newChunks.slice(-50), // Keep last 50 chunks
                  whisperRawChunks: newRawChunks.slice(-100), // Keep last 100 raw chunks for merger
                  whisperWordCount: wordCount,
                  mergedTranscript: bestOfBothResult.transcript,
                  mergedWordCount: bestOfBothResult.wordCount,
                  mergeStats: bestOfBothResult.stats,
                  keptChunks: bestOfBothResult.kept,
                  droppedChunks: bestOfBothResult.dropped
                };
              });
            }
          },
          (error: string) => {
            console.error('Whisper error:', error);
            updateState({ whisperStatus: 'error' });
            showShadcnToast({
              title: "Whisper Error", 
              description: error,
              variant: "destructive",
              section: 'meeting_manager'
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

        let isFirstChunk = true;

        mediaRecorder.ondataavailable = (event) => {
          console.log('📊 MediaRecorder data available:', event.data.size, 'bytes', 'First chunk:', isFirstChunk);
          if (event.data.size > 0 && whisperTranscriberRef.current) {
            console.log('🎤 Sending audio chunk to Whisper transcriber');
            whisperTranscriberRef.current.enqueueChunk(event.data);
          } else if (!whisperTranscriberRef.current) {
            console.error('❌ WhisperTranscriber ref is null!');
          }
        };

        console.log('🎙️ Setting up MediaRecorder for Whisper chunks, isFirstChunk:', isFirstChunk);
        // Start with 5 seconds for first chunk, then 2 seconds
        mediaRecorder.start(5000);
        
        mediaRecorder.onstop = () => {
          if (isFirstChunk && mediaRecorder && mediaRecorder.state === 'inactive' && state.isRecording) {
            isFirstChunk = false;
            console.log('🔄 First chunk completed, switching to 2-second intervals');
            // Restart with 2-second intervals after first chunk
            mediaRecorder.start(2000);
          }
        };
      }

      showShadcnToast({
        title: "Dual Transcription Started",
        description: `Recording with ${state.assemblyEnabled ? 'Assembly AI' : ''}${state.assemblyEnabled && state.whisperEnabled ? ' and ' : ''}${state.whisperEnabled ? 'Whisper' : ''}`,
        section: 'meeting_manager'
      });

    } catch (error) {
      console.error('Error starting dual transcription:', error);
      updateState({ isRecording: false });
      showShadcnToast({
        title: "Error",
        description: "Failed to start transcription services",
        variant: "destructive",
        section: 'meeting_manager'
      });
    }
  }, [state.assemblyEnabled, state.whisperEnabled, saveTranscriptChunk, updateState]);

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

      // Save final transcripts and complete meeting
      if (currentMeetingId) {
        // Use the best word count (max of merged, assembly, or whisper)
        const totalWords = Math.max(state.mergedWordCount, state.assemblyWordCount, state.whisperWordCount);
        await supabase.from('meetings').update({
          status: 'completed',
          end_time: new Date().toISOString(),
          word_count: totalWords,
          primary_transcript_source: state.primarySource === 'merged' ? 'best_of_both' : state.primarySource,
          notes_generation_status: 'queued'
        }).eq('id', currentMeetingId);
      }

      showShadcnToast({
        title: "Transcription Stopped",
        description: "Both transcription services have been stopped and saved",
        section: 'meeting_manager'
      });

    } catch (error) {
      console.error('Error stopping transcription:', error);
      showShadcnToast({
        title: "Error",
        description: "Error stopping transcription services",
        variant: "destructive",
        section: 'meeting_manager'
      });
    }
  }, [currentMeetingId, state.assemblyTranscript, state.whisperTranscript, state.assemblyConfidence, state.whisperConfidence, state.primarySource, state.assemblyWordCount, state.whisperWordCount, updateState]);

  const toggleService = useCallback((service: 'assembly' | 'whisper') => {
    if (state.isRecording) {
      showShadcnToast({
        title: "Cannot Change Services",
        description: "Stop recording before changing transcription services",
        variant: "destructive",
        section: 'meeting_manager'
      });
      return;
    }

    if (service === 'assembly') {
      updateState({ assemblyEnabled: !state.assemblyEnabled });
    } else {
      updateState({ whisperEnabled: !state.whisperEnabled });
    }
  }, [state.isRecording, state.assemblyEnabled, state.whisperEnabled, updateState]);

  const setPrimarySource = useCallback((source: 'assembly' | 'whisper' | 'merged') => {
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