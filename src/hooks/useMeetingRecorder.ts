import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AttendeeInfo {
  id: string;
  name: string;
  role: string;
}

interface TranscriptEntry {
  id: string;
  timestamp: Date;
  speaker?: string;
  text: string;
  confidence?: number;
}

interface MeetingRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  transcript: string;
  transcriptEntries: TranscriptEntry[];
  isTranscribing: boolean;
  meetingTitle: string;
  attendees: AttendeeInfo[];
}

export const useMeetingRecorder = () => {
  // State
  const [state, setState] = useState<MeetingRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioLevel: 0,
    transcript: '',
    transcriptEntries: [],
    isTranscribing: false,
    meetingTitle: '',
    attendees: []
  });

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio level monitoring
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = (average / 255) * 100;
    
    setState(prev => ({ ...prev, audioLevel: normalizedLevel }));
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // Setup audio analyzer
  const setupAudioAnalyzer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      audioStreamRef.current = stream;
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      
      return stream;
    } catch (error) {
      console.error('Error setting up audio analyzer:', error);
      toast.error('Failed to access microphone');
      throw error;
    }
  }, []);

  // Process audio chunk for transcription
  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        const { data, error } = await supabase.functions.invoke('speech-to-text', {
          body: {
            audio: base64Audio,
            language: 'en',
            temperature: 0.0
          }
        });

        if (error) {
          console.error('Transcription error:', error);
          return;
        }

        const text = data.text?.trim();
        if (text && text.length > 0) {
          const entry: TranscriptEntry = {
            id: `entry-${Date.now()}`,
            timestamp: new Date(),
            text,
            confidence: data.confidence
          };

          setState(prev => ({
            ...prev,
            transcriptEntries: [...prev.transcriptEntries, entry],
            transcript: prev.transcript + (prev.transcript ? ' ' : '') + text
          }));
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await setupAudioAnalyzer();
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      const chunks: Blob[] = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          processAudioChunk(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await saveRecordingSession(audioBlob);
      };

      mediaRecorderRef.current.start(1000);
      startTimeRef.current = new Date();
      
      setState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        isTranscribing: true
      }));
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current && !state.isPaused) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setState(prev => ({ ...prev, duration: elapsed }));
        }
      }, 1000);

      updateAudioLevel();
      toast.success('Recording started');

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  }, [setupAudioAnalyzer, updateAudioLevel, state.isPaused, processAudioChunk]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setState(prev => ({
      ...prev,
      isRecording: false,
      isPaused: false,
      isTranscribing: false,
      audioLevel: 0
    }));

    toast.success('Recording stopped');
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      toast.info('Recording paused');
    }
  }, [state.isRecording]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isPaused) {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
      
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setState(prev => ({ ...prev, duration: elapsed }));
        }
      }, 1000);

      toast.info('Recording resumed');
    }
  }, [state.isPaused]);

  // Save recording session
  const saveRecordingSession = useCallback(async (audioBlob: Blob) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      const fileName = `meeting-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, audioBlob);

      if (uploadError) {
        console.error('Error uploading audio:', uploadError);
        toast.error('Failed to save audio recording');
        return;
      }

      const meetingData = {
        title: state.meetingTitle || `Meeting ${new Date().toLocaleDateString()}`,
        user_id: user.id,
        start_time: startTimeRef.current?.toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: Math.ceil(state.duration / 60),
        transcript: state.transcript,
        audio_backup_path: uploadData.path,
        meeting_notes: JSON.stringify({ attendees: state.attendees })
      };

      const { error: dbError } = await supabase
        .from('meetings')
        .insert(meetingData);

      if (dbError) {
        console.error('Error saving meeting data:', dbError);
        toast.error('Failed to save meeting data');
        return;
      }

      toast.success('Meeting saved successfully');
    } catch (error) {
      console.error('Error saving recording session:', error);
      toast.error('Failed to save recording session');
    }
  }, [state.meetingTitle, state.duration, state.transcript, state.attendees]);

  // Update state functions
  const setMeetingTitle = useCallback((title: string) => {
    setState(prev => ({ ...prev, meetingTitle: title }));
  }, []);

  const addAttendee = useCallback(() => {
    const newAttendee: AttendeeInfo = {
      id: `attendee-${Date.now()}`,
      name: '',
      role: ''
    };
    setState(prev => ({ ...prev, attendees: [...prev.attendees, newAttendee] }));
  }, []);

  const updateAttendee = useCallback((id: string, field: keyof AttendeeInfo, value: string) => {
    setState(prev => ({
      ...prev,
      attendees: prev.attendees.map(attendee => 
        attendee.id === id ? { ...attendee, [field]: value } : attendee
      )
    }));
  }, []);

  const removeAttendee = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      attendees: prev.attendees.filter(attendee => attendee.id !== id)
    }));
  }, []);

  const setTranscript = useCallback((transcript: string) => {
    setState(prev => ({ ...prev, transcript }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    state,
    actions: {
      startRecording,
      stopRecording,
      pauseRecording,
      resumeRecording,
      setMeetingTitle,
      addAttendee,
      updateAttendee,
      removeAttendee,
      setTranscript
    }
  };
};