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

  const startRecording = useCallback(async () => {
    if (!isResourceOperationSafe()) {
      toast.error('Cannot start recording while another operation is in progress');
      return false;
    }

    try {
      setState(prev => ({ ...prev, isRecording: true }));
      
      const transcriber = createTranscriber();
      transcriberRef.current = transcriber;
      
      await transcriber.startTranscription();
      
      // Create initial meeting record with "recording" status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: meetingError } = await supabase
          .from('meetings')
          .insert({
            user_id: user.id,
            title: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            status: 'recording',
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

      toast.success('Recording started');
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      setState(prev => ({ ...prev, isRecording: false }));
      return false;
    }
  }, [isResourceOperationSafe, createTranscriber, onDurationUpdate, formatDuration]);

  const stopRecording = useCallback(async () => {
    setState(prev => ({ ...prev, isStoppingRecording: true }));

    try {
      if (transcriberRef.current) {
        await transcriberRef.current.stopTranscription();
        transcriberRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Save meeting and queue auto-notes generation if transcript exists
      if (state.transcript && state.transcript.trim().length > 50) {
        await saveMeetingAndQueueNotes();
      }

      setState(prev => ({
        ...prev,
        isRecording: false,
        isStoppingRecording: false,
        isConnected: false
      }));

      toast.success('Recording stopped');
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording');
      setState(prev => ({ ...prev, isStoppingRecording: false }));
      return false;
    }
  }, [state.transcript]);

  const saveMeetingAndQueueNotes = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to save meetings');
        return;
      }

      // Find existing recording meeting to update, or create new one
      const { data: existingMeeting } = await supabase
        .from('meetings')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'recording')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let meeting;
      
      if (existingMeeting) {
        // Update existing recording meeting to completed
        const { data: updatedMeeting, error: updateError } = await supabase
          .from('meetings')
          .update({
            duration_minutes: Math.ceil(state.duration / 60),
            word_count: state.wordCount,
            speaker_count: state.speakerCount,
            status: 'completed',
            title: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
          })
          .eq('id', existingMeeting.id)
          .select()
          .single();

        if (updateError) throw updateError;
        meeting = updatedMeeting;
        console.log('✅ Updated existing meeting to completed:', meeting.id);
      } else {
        // Create new meeting if no recording meeting found
        const meetingData = {
          user_id: user.id,
          title: `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          duration_minutes: Math.ceil(state.duration / 60),
          word_count: state.wordCount,
          speaker_count: state.speakerCount,
          status: 'completed' as const,
          notes_generation_status: 'not_started' as const
        };

        const { data: newMeeting, error: insertError } = await supabase
          .from('meetings')
          .insert(meetingData)
          .select()
          .single();

        if (insertError) throw insertError;
        meeting = newMeeting;
        console.log('✅ Created new completed meeting:', meeting.id);
      }

      if (!meeting) {
        console.error('Failed to save meeting: No meeting returned');
        toast.error('Failed to save meeting');
        return;
      }

      // Save transcript chunks
      if (state.realtimeTranscripts.length > 0) {
        const transcriptInserts = state.realtimeTranscripts.map((transcript, index) => ({
          meeting_id: meeting.id,
          content: transcript.text,
          timestamp_seconds: new Date(transcript.timestamp).getTime() / 1000,
          confidence_score: transcript.confidence || 0.8
        }));

        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert(transcriptInserts);

        if (transcriptError) {
          console.error('Failed to save transcripts:', transcriptError);
        }
      }

      // Queue auto-notes generation
      const { error: queueError } = await supabase
        .from('meeting_notes_queue')
        .insert({
          meeting_id: meeting.id,
          status: 'pending',
          detail_level: 'standard',
          priority: 0
        });

      if (queueError) {
        console.error('Failed to queue notes generation:', queueError);
      } else {
        toast.success('Meeting saved and notes generation queued');
      }

    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    }
  }, [state.duration, state.wordCount, state.speakerCount, state.realtimeTranscripts]);

  const resetRecording = useCallback(() => {
    setState({
      isRecording: false,
      isStoppingRecording: false,
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