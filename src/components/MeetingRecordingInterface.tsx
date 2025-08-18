import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Square, Play, Pause, FileText, Clock, Users, Sparkles, Monitor } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface MeetingRecordingInterfaceProps {
  onClose: () => void;
}

export const MeetingRecordingInterface: React.FC<MeetingRecordingInterfaceProps> = ({ onClose }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [autoSummarize, setAutoSummarize] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed'>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    if (!meetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    try {
      // Create meeting record
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: meetingTitle,
          user_id: user?.id,
          start_time: new Date().toISOString(),
          status: 'in_progress'
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      setCurrentMeetingId(meeting.id);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(5000); // Collect data every 5 seconds
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      toast.success('Recording stopped. Processing...');
      setProcessingStatus('processing');
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    if (!currentMeetingId) return;

    try {
      console.log('Processing recording for meeting:', currentMeetingId);
      console.log('Audio blob size:', audioBlob.size);

      // Create FormData for the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      console.log('Sending audio to transcription service...');

      // Upload and transcribe audio using FormData
      const transcriptionResponse = await fetch(`https://dphcnbricafkbtizkoal.supabase.co/functions/v1/audio-transcription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`,
        },
        body: formData,
      });

      const transcriptionData = await transcriptionResponse.json();
      console.log('Transcription response:', transcriptionData);

      if (!transcriptionResponse.ok || !transcriptionData.success) {
        console.error('Transcription error:', transcriptionData);
        toast.error('Failed to transcribe audio: ' + (transcriptionData.error || 'Unknown error'));
        setProcessingStatus('idle');
        return;
      }

      if (transcriptionData?.transcript) {
        console.log('Transcript received:', transcriptionData.transcript);
        setTranscript(transcriptionData.transcript);
        
        // Store transcript in meeting_transcripts table
        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert({
            meeting_id: currentMeetingId,
            content: transcriptionData.transcript,
            speaker_name: 'Recording',
            timestamp_seconds: 0,
            confidence_score: transcriptionData.confidence || 0.95
          });

        if (transcriptError) {
          console.error('Error storing transcript:', transcriptError);
        }

        // Update meeting status
        const { error: meetingUpdateError } = await supabase
          .from('meetings')
          .update({
            end_time: new Date().toISOString(),
            status: 'completed'
          })
          .eq('id', currentMeetingId);

        if (meetingUpdateError) {
          console.error('Error updating meeting:', meetingUpdateError);
        }

        // Auto-summarize if enabled
        if (autoSummarize) {
          await generateMeetingSummary(transcriptionData.text);
        }

        setProcessingStatus('completed');
        toast.success('Meeting processed successfully');
      } else {
        console.warn('No transcript received from transcription service');
        toast.error('No transcript was generated. The audio may be too short or unclear.');
        setProcessingStatus('idle');
      }

    } catch (error) {
      console.error('Error processing recording:', error);
      toast.error('Failed to process recording: ' + (error as Error).message);
      setProcessingStatus('idle');
    }
  };

  const generateMeetingSummary = async (transcriptText: string) => {
    if (!currentMeetingId) return;

    try {
      console.log('Generating summary for meeting:', currentMeetingId);
      
      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        'generate-meeting-minutes',
        {
          body: {
            transcript: transcriptText,
            meetingId: currentMeetingId
          }
        }
      );

      console.log('Summary response:', { summaryData, summaryError });

      if (summaryError) {
        console.error('Summary generation error:', summaryError);
        toast.error('Failed to generate summary: ' + summaryError.message);
        return;
      }

      if (summaryData?.summary) {
        const { error: summaryInsertError } = await supabase
          .from('meeting_summaries')
          .insert({
            meeting_id: currentMeetingId,
            summary: summaryData.summary,
            key_points: summaryData.key_points || [],
            action_items: summaryData.action_items || [],
            decisions: summaryData.decisions || [],
            next_steps: summaryData.next_steps || [],
            ai_generated: true
          });

        if (summaryInsertError) {
          console.error('Error storing summary:', summaryInsertError);
          toast.error('Failed to store summary');
        } else {
          toast.success('Meeting summary generated');
        }
      } else {
        console.warn('No summary received from summary service');
        toast.error('Summary generation failed - no content returned');
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate meeting summary: ' + (error as Error).message);
    }
  };

  const viewMeetingDetails = () => {
    if (currentMeetingId) {
      navigate(`/meeting-summary/${currentMeetingId}`);
    }
  };

  const viewMeetingHistory = () => {
    navigate('/meeting-history');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Meeting Recording Service
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Meeting Setup */}
        {!currentMeetingId && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="meeting-title">Meeting Title</Label>
              <Input
                id="meeting-title"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title..."
                className="mt-1"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-summarize"
                checked={autoSummarize}
                onChange={(e) => setAutoSummarize(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="auto-summarize" className="text-sm">
                Automatically generate meeting summary after recording
              </Label>
            </div>

            <Button 
              onClick={startRecording} 
              disabled={isRecording || !meetingTitle.trim()}
              className="w-full"
            >
              <Mic className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          </div>
        )}

        {/* Recording Controls */}
        {currentMeetingId && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="font-semibold text-lg">{meetingTitle}</h3>
              <div className="flex items-center justify-center gap-4 mt-2">
                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                    Recording
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {formatTime(recordingTime)}
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2">
              {isRecording ? (
                <Button onClick={stopRecording} variant="destructive">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording
                </Button>
              ) : (
                <Button onClick={startRecording} disabled={processingStatus === 'processing'}>
                  <Mic className="h-4 w-4 mr-2" />
                  Resume Recording
                </Button>
              )}
            </div>

            {/* Processing Status */}
            {processingStatus === 'processing' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">
                  Processing recording and generating transcript...
                </p>
              </div>
            )}

            {/* Transcript Preview */}
            {transcript && (
              <div className="space-y-2">
                <Label>Transcript Preview</Label>
                <div className="bg-muted p-3 rounded-lg max-h-32 overflow-y-auto text-sm">
                  {transcript.substring(0, 200)}
                  {transcript.length > 200 && '...'}
                </div>
              </div>
            )}

            {/* Actions */}
            {processingStatus === 'completed' && (
              <div className="flex gap-2">
                <Button onClick={viewMeetingDetails} className="flex-1">
                  <FileText className="h-4 w-4 mr-2" />
                  View Meeting Details
                </Button>
                {!autoSummarize && transcript && (
                  <Button 
                    onClick={() => generateMeetingSummary(transcript)}
                    variant="outline"
                    className="flex-1"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Summary
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={viewMeetingHistory}>
            <FileText className="h-4 w-4 mr-2" />
            View All Recordings
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};