import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square, 
  Download, 
  FileText, 
  Clock, 
  Users,
  Settings,
  Volume2,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AssemblyAIRealtimeTranscriber, TranscriptData } from '@/utils/AssemblyAIRealtimeTranscriber';

interface AttendeeInfo {
  id: string;
  name: string;
  role: string;
}

interface MeetingSession {
  id: string;
  title: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  attendees: AttendeeInfo[];
  transcript: string;
  audioLevel: number;
  status: 'idle' | 'recording' | 'paused' | 'stopped';
}

interface TranscriptEntry {
  id: string;
  timestamp: Date;
  speaker?: string;
  text: string;
  confidence?: number;
}

interface MeetingRecorderProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onDurationUpdate?: (duration: string) => void;
  onWordCountUpdate?: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
    attendees: string;
    practiceId: string;
    meetingFormat: string;
    transcriberService?: 'whisper' | 'deepgram' | 'assemblyai';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
      assemblyai: number;
    };
  };
}

const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ 
  onTranscriptUpdate, 
  onDurationUpdate, 
  onWordCountUpdate, 
  initialSettings 
}) => {
  // Core recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Meeting metadata
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [currentSession, setCurrentSession] = useState<MeetingSession | null>(null);
  
  // Transcription state
  const [transcript, setTranscript] = useState('');
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState('Ready');
  
  // Transcriber references
  const assemblyTranscriberRef = useRef<AssemblyAIRealtimeTranscriber | null>(null);
  const selectedServiceRef = useRef<'whisper' | 'deepgram' | 'assemblyai'>('whisper');
  
  // Audio references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format duration
  const formatDuration = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Initialize from props
  useEffect(() => {
    if (initialSettings?.title) {
      setMeetingTitle(initialSettings.title);
    }
    if (initialSettings?.transcriberService) {
      selectedServiceRef.current = initialSettings.transcriberService;
    }
  }, [initialSettings]);

  // Update parent components when transcript or duration changes
  useEffect(() => {
    onTranscriptUpdate?.(transcript);
  }, [transcript, onTranscriptUpdate]);

  useEffect(() => {
    onDurationUpdate?.(formatDuration(duration));
  }, [duration, onDurationUpdate, formatDuration]);

  useEffect(() => {
    const wordCount = transcript.split(' ').filter(w => w.trim()).length;
    onWordCountUpdate?.(wordCount);
  }, [transcript, onWordCountUpdate]);

  // Audio level monitoring
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = (average / 255) * 100;
    
    setAudioLevel(normalizedLevel);
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  // Initialize transcriber based on selected service
  const initializeTranscriber = useCallback(() => {
    const service = selectedServiceRef.current;
    console.log('🔄 Initializing transcriber for service:', service);
    
    if (service === 'assemblyai') {
      assemblyTranscriberRef.current = new AssemblyAIRealtimeTranscriber(
        (data: TranscriptData) => {
          console.log('📝 AssemblyAI transcription received:', data);
          const minConfidence = initialSettings?.transcriberThresholds?.assemblyai || 0.85;
          
          if (data.confidence >= minConfidence) {
            const entry: TranscriptEntry = {
              id: `entry-${Date.now()}-${Math.random()}`,
              timestamp: new Date(),
              text: data.text,
              confidence: data.confidence
            };
            
            if (data.is_final) {
              console.log('✅ Final transcript entry:', entry.text);
              setTranscriptEntries(prev => [...prev, entry]);
              setTranscript(prev => prev + (prev ? ' ' : '') + data.text);
            }
          } else {
            console.log('⚠️ Transcript confidence too low:', data.confidence, 'min:', minConfidence);
          }
        },
        (error: string) => {
          console.error('❌ AssemblyAI error:', error);
          toast.error(`Transcription error: ${error}`);
          setTranscriptionStatus('Error');
        },
        (status: string) => {
          console.log('📊 AssemblyAI status:', status);
          setTranscriptionStatus(status);
        }
      );
    }
  }, [initialSettings?.transcriberThresholds?.assemblyai]);

  // Initialize audio context and analyzer  
  const startTranscription = useCallback(async () => {
    const service = selectedServiceRef.current;
    console.log('🚀 Starting transcription with service:', service);
    
    try {
      if (service === 'assemblyai') {
        if (!assemblyTranscriberRef.current) {
          initializeTranscriber();
        }
        
        if (assemblyTranscriberRef.current) {
          await assemblyTranscriberRef.current.startTranscription();
          console.log('✅ AssemblyAI transcription started');
        }
      } else {
        // For Whisper, we'll use the existing chunk-based approach
        console.log('✅ Whisper transcription ready (chunk-based)');
        setTranscriptionStatus('Ready for chunks');
      }
    } catch (error) {
      console.error('❌ Failed to start transcription:', error);
      toast.error('Failed to start transcription');
      setTranscriptionStatus('Error');
    }
  }, [initializeTranscriber]);

  // Stop transcription
  const stopTranscription = useCallback(() => {
    console.log('🛑 Stopping transcription for service:', selectedServiceRef.current);
    
    if (assemblyTranscriberRef.current) {
      assemblyTranscriberRef.current.stopTranscription();
      assemblyTranscriberRef.current = null;
    }
    
    setTranscriptionStatus('Stopped');
  }, []);
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
          // Send chunk for real-time transcription based on selected service
          if (selectedServiceRef.current === 'whisper') {
            processAudioChunk(event.data);
          }
          // AssemblyAI handles audio streaming via its own capture mechanism
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        await saveRecordingSession(audioBlob);
      };

      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      startTimeRef.current = new Date();
      
      setIsRecording(true);
      setIsPaused(false);
      setIsTranscribing(true);
      
      // Start transcription service
      await startTranscription();
      
      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current && !isPaused) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setDuration(elapsed);
        }
      }, 1000);

      // Start audio level monitoring
      updateAudioLevel();

      // Create session
      const sessionId = `session-${Date.now()}`;
      const newSession: MeetingSession = {
        id: sessionId,
        title: meetingTitle || `Meeting ${new Date().toLocaleDateString()}`,
        startTime: new Date(),
        duration: 0,
        attendees,
        transcript: '',
        audioLevel: 0,
        status: 'recording'
      };
      
      setCurrentSession(newSession);
      toast.success('Recording started');

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  }, [meetingTitle, attendees, setupAudioAnalyzer, updateAudioLevel, isPaused, startTranscription]);

  // Process audio chunk for transcription (Whisper only)
  const processAudioChunk = useCallback(async (audioBlob: Blob) => {
    if (selectedServiceRef.current !== 'whisper') {
      return; // Only process chunks for Whisper
    }
    
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        const minConfidence = initialSettings?.transcriberThresholds?.whisper || 0.75;

        const { data, error } = await supabase.functions.invoke('speech-to-text', {
          body: {
            audio: base64Audio,
            language: 'en',
            temperature: 0.0
          }
        });

        if (error) {
          console.error('Whisper transcription error:', error);
          return;
        }

        const text = data.text?.trim();
        if (text && text.length > 0 && (data.confidence || 1) >= minConfidence) {
          const entry: TranscriptEntry = {
            id: `entry-${Date.now()}`,
            timestamp: new Date(),
            text,
            confidence: data.confidence
          };

          setTranscriptEntries(prev => [...prev, entry]);
          setTranscript(prev => prev + (prev ? ' ' : '') + text);
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }, [initialSettings?.transcriberThresholds?.whisper]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      toast.info('Recording paused');
    }
  }, [isRecording]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume duration timer
      durationIntervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
          setDuration(elapsed);
        }
      }, 1000);

      toast.info('Recording resumed');
    }
  }, [isPaused]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    // Stop audio monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    // Stop audio streams
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    setIsRecording(false);
    setIsPaused(false);
    setIsTranscribing(false);
    setAudioLevel(0);
    
    // Stop transcription service
    stopTranscription();

    if (currentSession) {
      setCurrentSession(prev => prev ? {
        ...prev,
        endTime: new Date(),
        duration,
        transcript,
        status: 'stopped'
      } : null);
    }

    toast.success('Recording stopped');
  }, [duration, transcript, currentSession, stopTranscription]);

  // Save recording session
  const saveRecordingSession = useCallback(async (audioBlob: Blob) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        return;
      }

      // Upload audio file to Supabase Storage
      const fileName = `meeting-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-recordings')
        .upload(fileName, audioBlob);

      if (uploadError) {
        console.error('Error uploading audio:', uploadError);
        toast.error('Failed to save audio recording');
        return;
      }

      // Save meeting metadata to database
      const meetingData = {
        title: meetingTitle || `Meeting ${new Date().toLocaleDateString()}`,
        user_id: user.id,
        start_time: startTimeRef.current?.toISOString(),
        end_time: new Date().toISOString(),
        duration_minutes: Math.ceil(duration / 60),
        transcript,
        audio_backup_path: uploadData.path,
        meeting_notes: JSON.stringify({ attendees })
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
  }, [meetingTitle, duration, transcript, attendees]);

  // Add attendee
  const addAttendee = useCallback(() => {
    const newAttendee: AttendeeInfo = {
      id: `attendee-${Date.now()}`,
      name: '',
      role: ''
    };
    setAttendees(prev => [...prev, newAttendee]);
  }, []);

  // Update attendee
  const updateAttendee = useCallback((id: string, field: keyof AttendeeInfo, value: string) => {
    setAttendees(prev => prev.map(attendee => 
      attendee.id === id ? { ...attendee, [field]: value } : attendee
    ));
  }, []);

  // Remove attendee
  const removeAttendee = useCallback((id: string) => {
    setAttendees(prev => prev.filter(attendee => attendee.id !== id));
  }, []);

  // Export transcript
  const exportTranscript = useCallback(() => {
    const content = `Meeting: ${meetingTitle || 'Untitled Meeting'}
Date: ${new Date().toLocaleDateString()}
Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}
Attendees: ${attendees.map(a => `${a.name} (${a.role})`).join(', ')}

Transcript:
${transcript}

Detailed Entries:
${transcriptEntries.map(entry => 
  `[${entry.timestamp.toLocaleTimeString()}] ${entry.text}`
).join('\n')}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meetingTitle || 'meeting'}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Transcript exported');
  }, [meetingTitle, duration, attendees, transcript, transcriptEntries]);

  // Removed duplicate formatDuration function

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop transcription services
      stopTranscription();
      
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
  }, [stopTranscription]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meeting Recorder</h1>
          <p className="text-muted-foreground">Record and transcribe your meetings in real-time</p>
        </div>
        <Badge variant={isRecording ? "destructive" : "secondary"}>
          {isRecording ? (isPaused ? "Paused" : "Recording") : "Ready"}
        </Badge>
      </div>

      {/* Meeting Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Meeting Setup
          </CardTitle>
          <CardDescription>Configure your meeting details before recording</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="meeting-title">Meeting Title</Label>
            <Input
              id="meeting-title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Enter meeting title"
              disabled={isRecording}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Attendees</Label>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={addAttendee}
                disabled={isRecording}
              >
                <Users className="h-4 w-4 mr-2" />
                Add Attendee
              </Button>
            </div>
            {attendees.map((attendee) => (
              <div key={attendee.id} className="flex gap-2 mb-2">
                <Input
                  placeholder="Name"
                  value={attendee.name}
                  onChange={(e) => updateAttendee(attendee.id, 'name', e.target.value)}
                  disabled={isRecording}
                />
                <Input
                  placeholder="Role"
                  value={attendee.role}
                  onChange={(e) => updateAttendee(attendee.id, 'role', e.target.value)}
                  disabled={isRecording}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => removeAttendee(attendee.id)}
                  disabled={isRecording}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recording Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recording Controls
          </CardTitle>
          <CardDescription>Control your meeting recording</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <Button onClick={startRecording} className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Start Recording
                </Button>
              ) : (
                <>
                  {!isPaused ? (
                    <Button onClick={pauseRecording} variant="secondary" className="flex items-center gap-2">
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button onClick={resumeRecording} className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      Resume
                    </Button>
                  )}
                  <Button onClick={stopRecording} variant="destructive" className="flex items-center gap-2">
                    <Square className="h-4 w-4" />
                    Stop Recording
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-mono text-lg">{formatDuration(duration)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <div className="w-24 bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-100" 
                    style={{ width: `${Math.min(audioLevel, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Transcript */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Live Transcript
              {isTranscribing && (
                <Badge variant="outline" className="animate-pulse">
                  {transcriptionStatus}
                </Badge>
              )}
              <Badge variant="secondary" className="ml-auto">
                {selectedServiceRef.current === 'whisper' && 'Whisper'}
                {selectedServiceRef.current === 'assemblyai' && 'AssemblyAI'}
                {selectedServiceRef.current === 'deepgram' && 'Deepgram'}
              </Badge>
            </CardTitle>
          <CardDescription>Real-time transcription of your meeting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transcriptEntries.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2 border rounded p-4">
                {transcriptEntries.map((entry) => (
                  <div key={entry.id} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground font-mono">
                      [{entry.timestamp.toLocaleTimeString()}]
                    </span>
                    <span>{entry.text}</span>
                    {entry.confidence && (
                      <Badge variant="outline" className="ml-auto">
                        {Math.round(entry.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Transcript will appear here as you record..."
              className="min-h-32"
              readOnly={isRecording}
            />

            <div className="flex gap-2">
              <Button 
                onClick={exportTranscript} 
                variant="outline" 
                disabled={!transcript}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export Transcript
              </Button>
              
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(transcript);
                  toast.success('Transcript copied to clipboard');
                }}
                variant="outline" 
                disabled={!transcript}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Copy to Clipboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Status */}
      {currentSession && (
        <Card>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
            <CardDescription>Session information and statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Title</Label>
                <p className="font-medium">{currentSession.title}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Start Time</Label>
                <p className="font-medium">{currentSession.startTime.toLocaleTimeString()}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Duration</Label>
                <p className="font-medium">{formatDuration(duration)}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Status</Label>
                <Badge variant={currentSession.status === 'recording' ? "destructive" : "secondary"}>
                  {currentSession.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MeetingRecorder;