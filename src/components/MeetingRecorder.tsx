// Import the emergency recovery for auto-execution
import './utils/quickMeetingRecovery';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Mic, MicOff, Square, Play, Pause, Volume2, VolumeX, Settings, AlertCircle, CheckCircle2, Clock, FileText, Loader2 } from 'lucide-react';
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
  meetingId: propMeetingId, 
  onMeetingComplete 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Core state
  const [meetingId, setMeetingId] = useState<string | null>(propMeetingId || null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [meetingStatus, setMeetingStatus] = useState<'idle' | 'recording' | 'paused' | 'completed'>('idle');
  
  // Audio recording hook
  const {
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    pauseRecording: pauseAudioRecording,
    resumeRecording: resumeAudioRecording,
    audioLevel,
    isRecording: audioIsRecording,
    error: audioError
  } = useAudioRecording();

  // Timer hook
  const { 
    elapsedTime, 
    startTimer, 
    pauseTimer, 
    resumeTimer, 
    stopTimer 
  } = useMeetingTimer();

  // Transcription hook
  const {
    transcript,
    isTranscribing,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    error: transcriptionError,
    wordCount
  } = useRealtimeTranscription(meetingId);

  // Audio playback hook
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    audioUrl
  } = useAudioPlayback(meetingId);

  // Settings hook
  const {
    settings,
    updateSettings,
    resetSettings
  } = useRecordingSettings();

  // Notes hook
  const {
    notes,
    notesStatus,
    generateNotes,
    regenerateNotes
  } = useMeetingNotes(meetingId);

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

      // Start audio recording
      await startAudioRecording(currentMeetingId);
      
      // Start transcription
      await startTranscription();
      
      // Start timer
      startTimer();
      
      setIsRecording(true);
      setIsPaused(false);
      setMeetingStatus('recording');
      
      toast.success('Recording started');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  };

  // Pause recording
  const pauseRecording = async () => {
    try {
      await pauseAudioRecording();
      pauseTranscription();
      pauseTimer();
      
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
      await resumeAudioRecording();
      resumeTranscription();
      resumeTimer();
      
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
      
      // Stop all recording processes
      await stopAudioRecording();
      stopTranscription();
      stopTimer();
      
      // Update meeting status to completed
      const endTime = new Date();
      const { error: updateError } = await supabase
        .from('meetings')
        .update({
          status: 'completed',
          end_time: endTime.toISOString(),
          updated_at: endTime.toISOString(),
          word_count: wordCount
        })
        .eq('id', meetingId);

      if (updateError) {
        console.error('❌ Failed to update meeting status:', updateError);
        toast.error('Failed to complete meeting');
        return;
      }

      console.log('✅ Meeting status updated to completed');
      
      setIsRecording(false);
      setIsPaused(false);
      setMeetingStatus('completed');
      
      toast.success('Recording completed successfully');
      
      // Trigger notes generation if there's transcript content
      if (wordCount > 0) {
        console.log('📝 Triggering notes generation...');
        setTimeout(() => {
          generateNotes();
        }, 2000);
      }
      
      // Call completion callback
      if (onMeetingComplete) {
        onMeetingComplete(meetingId);
      }
      
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

  // Get status icon
  const getStatusIcon = () => {
    switch (meetingStatus) {
      case 'recording': return <Mic className="h-3 w-3" />;
      case 'paused': return <Pause className="h-3 w-3" />;
      case 'completed': return <CheckCircle2 className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  // Handle errors
  useEffect(() => {
    if (audioError) {
      toast.error(`Audio Error: ${audioError}`);
    }
    if (transcriptionError) {
      toast.error(`Transcription Error: ${transcriptionError}`);
    }
  }, [audioError, transcriptionError]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                Meeting Recorder
                <Badge variant={getStatusBadgeVariant()}>
                  {getStatusIcon()}
                  {meetingStatus.charAt(0).toUpperCase() + meetingStatus.slice(1)}
                </Badge>
              </CardTitle>
              {meetingId && (
                <p className="text-sm text-muted-foreground">
                  Meeting ID: {meetingId}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meeting Title Input */}
          {!isRecording && meetingStatus !== 'completed' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Meeting Title</label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title..."
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            
            {/* Audio Level Indicator */}
            {isRecording && (
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-100"
                    style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
                  />
                </div>
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

          {/* Audio Visualizer */}
          {isRecording && (
            <AudioVisualizer 
              audioLevel={audioLevel}
              isRecording={!isPaused}
            />
          )}
        </CardContent>
      </Card>

      {/* Settings Panel */}
      {showSettings && (
        <RecordingSettings
          settings={settings}
          onUpdateSettings={updateSettings}
          onResetSettings={resetSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Transcription Display */}
      {(transcript || isTranscribing) && (
        <TranscriptionDisplay
          transcript={transcript}
          isTranscribing={isTranscribing}
          wordCount={wordCount}
        />
      )}

      {/* Audio Playback (for completed meetings) */}
      {meetingStatus === 'completed' && audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Audio Playback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={isPlaying ? pause : play}
                variant="outline"
                size="sm"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={currentTime}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              
              <div className="text-sm text-muted-foreground">
                {formatTime(Math.floor(currentTime))} / {formatTime(Math.floor(duration))}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={toggleMute}
                variant="ghost"
                size="sm"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-20"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meeting Notes */}
      {meetingStatus === 'completed' && (
        <MeetingNotes
          meetingId={meetingId!}
          notes={notes}
          status={notesStatus}
          onRegenerate={regenerateNotes}
          wordCount={wordCount}
        />
      )}

      {/* Navigation */}
      {meetingStatus === 'completed' && (
        <div className="flex justify-center">
          <Button
            onClick={() => navigate('/dashboard')}
            variant="outline"
          >
            <FileText className="h-4 w-4 mr-2" />
            View All Meetings
          </Button>
        </div>
      )}
    </div>
  );
};
