import { useState, useCallback, useRef, useEffect } from 'react';
import { useRecording } from '@/contexts/RecordingContext';
import { BrowserSpeechTranscriber } from '@/utils/BrowserSpeechTranscriber';
import { iPhoneWhisperTranscriber } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber } from '@/utils/DesktopWhisperTranscriber';
import { DeepgramTranscriber } from '@/utils/DeepgramTranscriber';
import { detectDevice } from '@/utils/DeviceDetection';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

export interface RecordingState {
  isRecording: boolean;
  isStoppingRecording: boolean;
  isCompleting: boolean;
  isCompleted: boolean;
  completionError?: string;
  duration: number;
  transcript: string;
  realtimeTranscripts: TranscriptData[];
  wordCount: number;
  speakerCount: number;
  isConnected: boolean;
  chunkCounter: number;
}

export interface RecordingSettings {
  transcriberService: 'whisper' | 'deepgram';
  title: string;
  description: string;
  meetingType: string;
  practiceId?: string;
  transcriberThresholds: {
    whisper: number;
    deepgram: number;
  };
}

// Deduplication utility functions
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().trim().split(/\s+/);
  const words2 = text2.toLowerCase().trim().split(/\s+/);
  
  if (words1.length === 0 && words2.length === 0) return 1;
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
};

const isWithinTimeWindow = (timestamp1: string, timestamp2: string, windowMs: number = 5000): boolean => {
  const time1 = new Date(timestamp1).getTime();
  const time2 = new Date(timestamp2).getTime();
  return Math.abs(time1 - time2) <= windowMs;
};

const deduplicateTranscripts = (transcripts: TranscriptData[]): TranscriptData[] => {
  const deduplicated: TranscriptData[] = [];
  const SIMILARITY_THRESHOLD = 0.7; // 70% similarity threshold
  const TIME_WINDOW_MS = 5000; // 5 second window for potential duplicates
  
  for (const current of transcripts) {
    // Skip empty transcripts
    if (!current.text || current.text.trim().length === 0) continue;
    
    let isDuplicate = false;
    
    // Check against existing deduplicated transcripts
    for (let i = deduplicated.length - 1; i >= 0; i--) {
      const existing = deduplicated[i];
      
      // If we're outside the time window, stop checking (transcripts are chronological)
      if (!isWithinTimeWindow(current.timestamp, existing.timestamp, TIME_WINDOW_MS)) {
        break;
      }
      
      // Calculate text similarity
      const similarity = calculateTextSimilarity(current.text, existing.text);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        
        // If current transcript is final and existing isn't, replace it
        if (current.isFinal && !existing.isFinal) {
          deduplicated[i] = current;
        }
        // If current has higher confidence, replace it
        else if (current.confidence > existing.confidence) {
          deduplicated[i] = current;
        }
        // If texts are identical, keep the final one or the one with higher confidence
        else if (current.text.trim() === existing.text.trim()) {
          if (current.isFinal && !existing.isFinal) {
            deduplicated[i] = current;
          } else if (current.confidence > existing.confidence) {
            deduplicated[i] = current;
          }
        }
        break;
      }
    }
    
    // If not a duplicate, add to deduplicated list
    if (!isDuplicate) {
      deduplicated.push(current);
    }
  }
  
  return deduplicated;
};

export function useRecordingManager(
  onTranscriptUpdate: (transcript: string) => void,
  onDurationUpdate: (duration: string) => void,
  onWordCountUpdate: (count: number) => void,
  initialSettings?: Partial<RecordingSettings>
) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isStoppingRecording: false,
    isCompleting: false,
    isCompleted: false,
    duration: 0,
    transcript: '',
    realtimeTranscripts: [],
    wordCount: 0,
    speakerCount: 1,
    isConnected: false,
    chunkCounter: 0
  });

  const [settings, setSettings] = useState<RecordingSettings>({
    transcriberService: 'whisper',
    title: '',
    description: '',
    meetingType: 'General Meeting',
    transcriberThresholds: {
      whisper: 0.5,
      deepgram: 0.8
    },
    ...initialSettings
  });

  const { isResourceOperationSafe } = useRecording();
  const transcriberRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const earlyChunkTimeout5sRef = useRef<NodeJS.Timeout | null>(null);
  const earlyChunkTimeout15sRef = useRef<NodeJS.Timeout | null>(null);
  const isIOS = detectDevice().isIOS;

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleTranscriptData = useCallback((data: any) => {
    const newTranscript: TranscriptData = {
      text: data.text || '',
      speaker: data.speaker || 'Speaker',
      confidence: data.confidence || 0,
      timestamp: new Date().toISOString(),
      isFinal: data.is_final || false
    };

    // Skip empty transcripts
    if (!newTranscript.text || newTranscript.text.trim().length === 0) {
      return;
    }

    setState(prev => {
      const updatedTranscripts = [...prev.realtimeTranscripts, newTranscript];
      
      // Apply deduplication
      const deduplicatedTranscripts = deduplicateTranscripts(updatedTranscripts);
      
      // Build full transcript from final, deduplicated transcripts
      const finalTranscripts = deduplicatedTranscripts.filter(t => t.isFinal);
      const fullTranscript = finalTranscripts
        .map(t => t.text.trim())
        .filter(text => text.length > 0)
        .join(' ');
      
      const wordCount = fullTranscript.trim().split(/\s+/).filter(word => word.length > 0).length;
      
      return {
        ...prev,
        realtimeTranscripts: deduplicatedTranscripts,
        transcript: fullTranscript,
        wordCount,
        chunkCounter: prev.chunkCounter + 1
      };
    });

    onTranscriptUpdate(newTranscript.text);
  }, [onTranscriptUpdate]);

  const createTranscriber = useCallback(() => {
    const onStatusChange = (status: string) => {
      setState(prev => ({ 
        ...prev, 
        isConnected: status === 'connected' || status === 'recording' 
      }));
    };

    const onError = (error: string) => {
      console.error('Transcriber error:', error);
      toast.error(`Transcription error: ${error}`);
    };

    if (settings.transcriberService === 'deepgram') {
      return new DeepgramTranscriber(
        handleTranscriptData,
        onError,
        onStatusChange
      );
    } else {
      if (isIOS) {
        return new iPhoneWhisperTranscriber(
          handleTranscriptData,
          onError,
          onStatusChange
        );
      } else {
        return new DesktopWhisperTranscriber(
          handleTranscriptData,
          onError,
          onStatusChange
        );
      }
    }
  }, [settings.transcriberService, isIOS, handleTranscriptData]);

  const saveEarlyChunk = useCallback(async (chunkLabel: string) => {
    console.log(`📝 Saving early chunk at ${chunkLabel}`);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the current recording meeting
      const { data: recordingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'recording')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!recordingMeeting || state.realtimeTranscripts.length === 0) {
        console.log(`⚠️ No recording meeting or transcripts for ${chunkLabel} chunk`);
        return;
      }

      // Get final transcripts only
      const finalTranscripts = state.realtimeTranscripts.filter(t => t.isFinal && t.text.trim());
      
      if (finalTranscripts.length === 0) {
        console.log(`⚠️ No final transcripts available for ${chunkLabel} chunk`);
        return;
      }

      const transcriptInserts = finalTranscripts.map((transcript) => ({
        meeting_id: recordingMeeting.id,
        content: transcript.text,
        timestamp_seconds: new Date(transcript.timestamp).getTime() / 1000,
        confidence_score: transcript.confidence || 0.8
      }));

      console.log(`💾 Inserting ${transcriptInserts.length} transcript chunks for ${chunkLabel}`);
      const { error: transcriptError } = await supabase
        .from('meeting_transcripts')
        .insert(transcriptInserts);

      if (transcriptError) {
        console.error(`❌ Failed to save ${chunkLabel} transcripts:`, transcriptError);
      } else {
        console.log(`✅ Successfully saved ${chunkLabel} transcript chunks`);
        toast.success(`Transcription active - ${finalTranscripts.length} chunks saved`);
      }
    } catch (error) {
      console.error(`❌ Error saving ${chunkLabel} chunk:`, error);
    }
  }, [state.realtimeTranscripts]);

  const startRecording = useCallback(async () => {
    if (!isResourceOperationSafe()) {
      toast.error('Cannot start recording while another operation is in progress');
      return false;
    }

    try {
      setState(prev => ({ 
        ...prev, 
        isRecording: true,
        duration: 0 
      }));
      
      const transcriber = createTranscriber();
      transcriberRef.current = transcriber;
      
      await transcriber.startTranscription();
      
      // Create initial meeting record with "recording" status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const startTime = new Date();
        const { error: meetingError } = await supabase
          .from('meetings')
          .insert({
            user_id: user.id,
            title: `Meeting ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}`,
            status: 'recording',
            start_time: startTime.toISOString(),
            notes_generation_status: 'not_started'
          });
          
        if (meetingError) {
          console.warn('Failed to create initial meeting record:', meetingError);
        } else {
          console.log('✅ Created initial meeting record with "recording" status');
        }
      }
      
      startTimeRef.current = new Date();
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setState(prev => ({ ...prev, duration: elapsed }));
          onDurationUpdate(formatDuration(elapsed));
        }
      }, 1000);

      // Set up early chunking timeouts for user feedback
      earlyChunkTimeout5sRef.current = setTimeout(() => {
        saveEarlyChunk('5-second');
      }, 5000);
      
      earlyChunkTimeout15sRef.current = setTimeout(() => {
        saveEarlyChunk('15-second');
      }, 15000);

      console.log('⏰ Early chunking timeouts set for 5s and 15s');
      toast.success('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      setState(prev => ({ ...prev, isRecording: false }));
      return false;
    }
  }, [isResourceOperationSafe, createTranscriber, onDurationUpdate, formatDuration, saveEarlyChunk]);

  const saveMeetingAndQueueNotes = useCallback(async () => {
    console.log('🔄 Starting meeting save process...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ No authenticated user found');
        toast.error('You must be logged in to save meetings');
        return false;
      }

      console.log('✅ User authenticated:', user.id);

      // Find existing recording meeting to update, or create new one
      console.log('🔍 Looking for existing recording meeting...');
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'recording')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let meeting;
      let retryCount = 0;
      const maxRetries = 3;
      
      if (existingMeeting) {
        console.log('📝 Found existing meeting to update:', existingMeeting.id);
        
        // Retry logic for status update
        while (retryCount < maxRetries) {
          try {
            const endTime = new Date();
            const { data: updatedMeeting, error: updateError } = await supabase
              .from('meetings')
              .update({
                duration_minutes: Math.ceil(state.duration / 60),
                word_count: state.wordCount,
                speaker_count: state.speakerCount,
                status: 'completed',
                end_time: endTime.toISOString(),
                title: `Meeting ${endTime.toLocaleDateString()} ${endTime.toLocaleTimeString()}`
              })
              .eq('id', existingMeeting.id)
              .select()
              .single();

            if (updateError) {
              console.error(`❌ Update attempt ${retryCount + 1} failed:`, updateError);
              if (retryCount === maxRetries - 1) throw updateError;
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
              continue;
            }

            meeting = updatedMeeting;
            console.log('✅ Successfully updated meeting to completed:', meeting.id);
            break;
          } catch (error) {
            console.error(`❌ Update attempt ${retryCount + 1} error:`, error);
            if (retryCount === maxRetries - 1) throw error;
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        console.log('📄 No existing recording meeting found, creating new one...');
        
        // Create new meeting if no recording meeting found
        const endTime = new Date();
        const startTime = startTimeRef.current || new Date(Date.now() - (state.duration * 1000));
        const meetingData = {
          user_id: user.id,
          title: `Meeting ${endTime.toLocaleDateString()} ${endTime.toLocaleTimeString()}`,
          duration_minutes: Math.ceil(state.duration / 60),
          word_count: state.wordCount,
          speaker_count: state.speakerCount,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'completed' as const,
          notes_generation_status: 'not_started' as const
        };

        console.log('📋 Meeting data to insert:', meetingData);

        const { data: newMeeting, error: insertError } = await supabase
          .from('meetings')
          .insert(meetingData)
          .select()
          .single();

        if (insertError) {
          console.error('❌ Failed to create new meeting:', insertError);
          throw insertError;
        }
        
        meeting = newMeeting;
        console.log('✅ Successfully created new meeting:', meeting.id);
      }

      if (!meeting) {
        console.error('❌ No meeting returned after save operation');
        toast.error('Failed to save meeting - no meeting data returned');
        return false;
      }

      // Save transcript chunks - CRITICAL for auto-notes generation
      console.log('💬 Processing transcript data...');
      console.log(`📊 Total realtime transcripts: ${state.realtimeTranscripts.length}`);
      
      if (state.realtimeTranscripts.length > 0) {
        const finalTranscripts = state.realtimeTranscripts.filter(t => t.isFinal && t.text.trim());
        console.log(`📝 Final transcripts to save: ${finalTranscripts.length}`);
        
        if (finalTranscripts.length > 0) {
          const transcriptInserts = finalTranscripts.map((transcript, index) => ({
            meeting_id: meeting.id,
            content: transcript.text,
            timestamp_seconds: new Date(transcript.timestamp).getTime() / 1000,
            confidence_score: transcript.confidence || 0.8
          }));

          console.log('💾 Inserting transcript chunks...');
          const { error: transcriptError } = await supabase
            .from('meeting_transcripts')
            .insert(transcriptInserts);

          if (transcriptError) {
            console.error('❌ Failed to save transcripts:', transcriptError);
            toast.error('Failed to save transcript - automation may not work');
          } else {
            console.log(`✅ Successfully saved ${transcriptInserts.length} transcript chunks`);
          }
        } else {
          console.warn('⚠️ No final transcripts to save - this may prevent automation');
        }
      } else {
        console.warn('⚠️ No realtime transcripts available - automation will not trigger');
      }

      // Verify automation trigger conditions
      console.log('🔍 Verifying automation trigger conditions...');
      console.log(`📋 Meeting status: ${meeting.status}`);
      console.log(`💬 Transcript count: ${state.realtimeTranscripts.filter(t => t.isFinal && t.text.trim()).length}`);
      
      if (meeting.status === 'completed' && state.realtimeTranscripts.filter(t => t.isFinal && t.text.trim()).length > 0) {
        console.log('✨ Automation conditions met! Database trigger should fire automatically.');
        toast.success(`Meeting saved successfully! Notes generation will begin automatically.`);
      } else {
        console.warn('⚠️ Automation conditions not met - manual trigger may be needed');
        toast.success(`Meeting saved successfully${meeting.id === existingMeeting?.id ? ' (updated existing)' : ' (new)'}`);
      }

      return true; // Indicate success
    } catch (error) {
      console.error('❌ Critical error in saveMeetingAndQueueNotes:', error);
      
      // Detailed error logging for debugging
      console.error('Save meeting error details:', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        meetingData: {
          duration: state.duration,
          wordCount: state.wordCount,
          transcriptChunks: state.realtimeTranscripts.length,
          finalTranscripts: state.realtimeTranscripts.filter(t => t.isFinal && t.text.trim()).length
        }
      });
      
      toast.error('Failed to save meeting - please try manual process or use meeting recovery');
      return false; // Indicate failure
    }
  }, [state.duration, state.wordCount, state.speakerCount, state.realtimeTranscripts]);

  const resetRecording = useCallback(() => {
    setState({
      isRecording: false,
      isStoppingRecording: false,
      isCompleting: false,
      isCompleted: false,
      duration: 0,
      transcript: '',
      realtimeTranscripts: [],
      wordCount: 0,
      speakerCount: 1,
      isConnected: false,
      chunkCounter: 0
    });
    
    onTranscriptUpdate('');
    onDurationUpdate('0:00');
    onWordCountUpdate(0);
  }, [onTranscriptUpdate, onDurationUpdate, onWordCountUpdate]);

  const stopRecording = useCallback(async () => {
    console.log('🛑 Stop recording initiated');
    setState(prev => ({ ...prev, isStoppingRecording: true }));

    try {
      console.log('🔄 Stopping transcriber...');
      if (transcriberRef.current) {
        await transcriberRef.current.stopTranscription();
        transcriberRef.current = null;
        console.log('✅ Transcriber stopped successfully');
      }

      console.log('⏱️ Clearing duration interval...');
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
        console.log('✅ Duration interval cleared');
      }

      // Clear early chunk timeouts
      if (earlyChunkTimeout5sRef.current) {
        clearTimeout(earlyChunkTimeout5sRef.current);
        earlyChunkTimeout5sRef.current = null;
      }
      if (earlyChunkTimeout15sRef.current) {
        clearTimeout(earlyChunkTimeout15sRef.current);
        earlyChunkTimeout15sRef.current = null;
      }
      console.log('✅ Early chunk timeouts cleared');

      // Update state to show completion in progress
      setState(prev => ({
        ...prev,
        isRecording: false,
        isStoppingRecording: false,
        isCompleting: true,
        isCompleted: false,
        completionError: undefined
      }));

      console.log('💾 Attempting to save meeting and queue notes...');
      const saveSuccess = await saveMeetingAndQueueNotes();
      
      if (!saveSuccess) {
        console.error('❌ CRITICAL: Meeting save failed - manual recovery needed');
        const errorMessage = 'Meeting save failed - please use Meeting Recovery Helper';
        
        setState(prev => ({
          ...prev,
          isCompleting: false,
          isCompleted: false,
          completionError: errorMessage,
          isConnected: false
        }));
        
        toast.error('Failed to save meeting properly. Please check the Meeting Recovery Helper.');
        return false;
      } else {
        console.log('✅ Meeting save process completed successfully');
        
        // Verify the meeting was actually saved and completed
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: completedMeeting, error: verificationError } = await supabase
              .from('meetings')
              .select('id, status, title')
              .eq('user_id', user.id)
              .eq('status', 'completed')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();

            if (verificationError || !completedMeeting) {
              console.warn('⚠️ Could not verify meeting completion - may need recovery');
              setState(prev => ({
                ...prev,
                isCompleting: false,
                isCompleted: true,
                completionError: 'Verification failed - please check meeting status',
                isConnected: false
              }));
              // Still reset after showing completion
              setTimeout(() => resetRecording(), 2000);
              toast.warning('Recording completed but verification failed. Please check your meetings.');
            } else {
              console.log('✅ Meeting completion verified:', completedMeeting.id);
              
              // Set completed state first, then reset after a delay
              setState(prev => ({
                ...prev,
                isCompleting: false,
                isCompleted: true,
                completionError: undefined,
                isConnected: false
              }));
              
              // Reset the recording state after showing completion
              setTimeout(() => resetRecording(), 2000);
              
              toast.success(`Meeting "${completedMeeting.title}" saved successfully! Notes generation will begin automatically.`);
            }
          }
        } catch (verificationError) {
          console.error('❌ Error verifying meeting completion:', verificationError);
          
          // Set completed state first, then reset
          setState(prev => ({
            ...prev,
            isCompleting: false,
            isCompleted: true,
            completionError: 'Verification error',
            isConnected: false
          }));
          
          // Reset recording state after showing completion
          setTimeout(() => resetRecording(), 2000);
        }
      }

      console.log('✅ Recording stop process completed');
      return true;
    } catch (error) {
      console.error('❌ Critical error in stop recording process:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      setState(prev => ({ 
        ...prev, 
        isStoppingRecording: false,
        isCompleting: false,
        completionError: `Stop failed: ${errorMessage}`,
        isConnected: false
      }));
      
      toast.error(`Failed to stop recording: ${errorMessage}`);
      
      // Log detailed error information for debugging
      console.error('Stop recording error details:', {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        errorMessage: errorMessage,
        stackTrace: error instanceof Error ? error.stack : undefined,
        state: {
          isRecording: state.isRecording,
          duration: state.duration,
          transcriptLength: state.transcript.length,
          chunksCount: state.realtimeTranscripts.length
        }
      });
      
      return false;
    }
  }, [state.transcript, state.realtimeTranscripts.length, state.isRecording, state.duration, saveMeetingAndQueueNotes, resetRecording]);

  // Update word count when transcript changes
  useEffect(() => {
    onWordCountUpdate(state.wordCount);
  }, [state.wordCount, onWordCountUpdate]);

  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
      if (earlyChunkTimeout5sRef.current) {
        clearTimeout(earlyChunkTimeout5sRef.current);
      }
      if (earlyChunkTimeout15sRef.current) {
        clearTimeout(earlyChunkTimeout15sRef.current);
      }
    };
  }, []);

  return {
    state,
    settings,
    setSettings,
    startRecording,
    stopRecording,
    resetRecording,
    formatDuration
  };
}