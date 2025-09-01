// Import the emergency recovery for auto-execution
import '../utils/quickMeetingRecovery';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mic, MicOff, Square, Play, Pause, Volume2, Settings, Clock, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface MeetingRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
    practiceId?: string;
    transcriberService?: 'whisper' | 'deepgram';
    transcriberThresholds?: {
      whisper: number;
      deepgram: number;
    };
  };
}

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ 
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Core state
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState(initialSettings?.title || '');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [meetingStatus, setMeetingStatus] = useState<'idle' | 'recording' | 'paused' | 'completed'>('idle');
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Create new meeting
  const createMeeting = async (title: string) => {
    if (!user) {
      toast.error('Please sign in to create a meeting');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title,
          user_id: user.id,
          status: 'recording',
          start_time: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ Meeting created:', data);
      return data.id;
    } catch (error) {
      console.error('❌ Failed to create meeting:', error);
      toast.error('Failed to create meeting');
      return null;
    }
  };

  // Start timer
  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        onDurationUpdate(formatTime(newTime));
        return newTime;
      });
    }, 1000);
  };

  // Stop timer
  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Update transcript and word count
  const updateTranscript = (newTranscript: string) => {
    setTranscript(newTranscript);
    const words = newTranscript.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    setWordCount(count);
    onTranscriptUpdate(newTranscript);
    onWordCountUpdate(count);
  };

  // Start recording
  const startRecording = async () => {
    if (!meetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      let currentMeetingId = meetingId;
      
      // Create meeting if it doesn't exist
      if (!currentMeetingId) {
        currentMeetingId = await createMeeting(meetingTitle);
        if (!currentMeetingId) return;
        setMeetingId(currentMeetingId);
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Setup MediaRecorder
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start(1000); // Record in 1-second chunks
      
      // Start timer
      startTimer();
      
      setIsRecording(true);
      setIsPaused(false);
      setMeetingStatus('recording');
      
      toast.success('Recording started');
      
      // Simulate transcript updates for demo
      setTimeout(() => {
        updateTranscript('Recording in progress...');
      }, 2000);
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  };

  // Pause recording
  const pauseRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause();
      }
      
      stopTimer();
      setIsPaused(true);
      setMeetingStatus('paused');
      
      toast.info('Recording paused');
    } catch (error) {
      console.error('❌ Failed to pause recording:', error);
      toast.error('Failed to pause recording');
    }
  };

  // Resume recording
  const resumeRecording = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume();
      }
      
      startTimer();
      setIsPaused(false);
      setMeetingStatus('recording');
      
      toast.success('Recording resumed');
    } catch (error) {
      console.error('❌ Failed to resume recording:', error);
      toast.error('Failed to resume recording');
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!meetingId) return;

    try {
      console.log('🛑 Stopping recording for meeting:', meetingId);
      
      // Stop MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
      
      // Stop timer
      stopTimer();
      
      // Update meeting status to completed with end_time
      const endTime = new Date();
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          status: 'completed',
          end_time: endTime.toISOString(),
          updated_at: endTime.toISOString(),
          word_count: wordCount,
          duration_minutes: Math.ceil(elapsedTime / 60)
        })
        .eq('id', meetingId);

      if (updateError) {
        console.error('❌ Failed to update meeting status:', updateError);
        toast.error('Failed to complete meeting');
        return;
      }

      console.log('✅ Meeting status updated to completed with end_time');
      
      // Save transcript if available
      if (transcript.trim()) {
        await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: meetingId,
            speaker_name: 'Meeting Recording',
            content: transcript,
            timestamp_seconds: 0,
            confidence_score: 1.0
          });
      }
      
      setIsRecording(false);
      setIsPaused(false);
      setMeetingStatus('completed');
      
      toast.success('Recording completed successfully');
      
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      toast.error('Failed to stop recording');
    }
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Get status badge variant
  const getStatusBadgeVariant = () => {
    switch (meetingStatus) {
      case 'recording': return 'destructive';
      case 'paused': return 'secondary';
      case 'completed': return 'default';
      default: return 'outline';
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recorder">
            <Mic className="h-4 w-4 mr-2" />
            Recorder
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <FileText className="h-4 w-4 mr-2" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <CardTitle className="flex items-center gap-2">
                    Meeting Recorder
                    <Badge variant={getStatusBadgeVariant()}>
                      <Clock className="h-3 w-3 mr-1" />
                      {meetingStatus.charAt(0).toUpperCase() + meetingStatus.slice(1)}
                    </Badge>
                  </CardTitle>
                  {meetingId && (
                    <p className="text-sm text-muted-foreground">
                      Meeting ID: {meetingId}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Meeting Title Input */}
              {!isRecording && meetingStatus !== 'completed' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meeting Title</label>
                  <Input
                    type="text"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Enter meeting title..."
                  />
                </div>
              )}

              {/* Timer and Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-mono font-bold">
                    {formatTime(elapsedTime)}
                  </div>
                  {wordCount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {wordCount} words transcribed
                    </div>
                  )}
                </div>
                
                {/* Recording indicator */}
                {isRecording && !isPaused && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-red-600 font-medium">Recording</span>
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-2">
                {!isRecording && meetingStatus !== 'completed' && (
                  <Button
                    onClick={startRecording}
                    disabled={!meetingTitle.trim()}
                    className="flex-1"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                )}
                
                {isRecording && !isPaused && (
                  <>
                    <Button
                      onClick={pauseRecording}
                      variant="outline"
                      className="flex-1"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Pause
                    </Button>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
                
                {isPaused && (
                  <>
                    <Button
                      onClick={resumeRecording}
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              {transcript ? (
                <div className="min-h-[200px] p-4 bg-muted rounded-lg">
                  <p className="whitespace-pre-wrap">{transcript}</p>
                </div>
              ) : (
                <div className="min-h-[200px] p-4 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
                  {isRecording ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Listening for speech...
                    </div>
                  ) : (
                    'Start recording to see live transcript'
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recording Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Meeting Type</label>
                <Input
                  value={initialSettings?.meetingType || 'general'}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Transcriber Service</label>
                <Input
                  value={initialSettings?.transcriberService || 'whisper'}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  value={initialSettings?.description || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};