import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, ArrowLeft, Loader2, Activity, Volume2, Sparkles } from 'lucide-react';
import { showToast } from '@/utils/toastWrapper';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BrowserSpeechTranscriber, TranscriptData } from '@/utils/BrowserSpeechTranscriber';

const BrowserRecorder = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);
  
  // Transcript state
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptData[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  
  // Meeting data
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Refs
  const transcriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkCounter = useRef(0);
  
  // Auto-generate meeting name with current date and time
  const generateMeetingName = () => {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB');
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `Meeting ${date} ${time}`;
  };
  
  // Format duration for display
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate expected words (5000 words/hour baseline)
  const getExpectedWords = (durationSeconds: number) => {
    const hours = durationSeconds / 3600;
    return Math.floor(hours * 5000);
  };
  
  // Calculate progress percentage
  const getWordProgress = () => {
    if (duration === 0) return 0;
    const expected = getExpectedWords(duration);
    if (expected === 0) return 0;
    return Math.min((wordCount / expected) * 100, 100);
  };
  
  // Handle transcription data
  const handleTranscription = (data: TranscriptData) => {
    if (data.is_final) {
      // Add to segments and save to database
      setTranscriptSegments(prev => [...prev, data]);
      setLiveTranscript('');
      saveTranscriptChunk(data.text);
      
      // Update word count
      const words = data.text.split(/\s+/).filter(word => word.length > 0);
      setWordCount(prev => prev + words.length);
    } else {
      // Update live transcript
      setLiveTranscript(data.text);
    }
  };
  
  // Handle transcription errors
  const handleError = (error: string) => {
    console.error('Browser transcription error:', error);
    showToast.error(`Transcription error: ${error}`, { section: 'meeting_manager' });
    setStatus(`Error: ${error}`);
  };
  
  // Handle status changes
  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };
  
  // Save transcript chunk to database
  const saveTranscriptChunk = async (text: string) => {
    if (!meetingId || !sessionId || !user) return;
    
    try {
      chunkCounter.current += 1;
      
      const { error } = await supabase
        .from('meeting_transcription_chunks')
        .insert({
          meeting_id: meetingId,
          session_id: sessionId,
          chunk_number: chunkCounter.current,
          transcription_text: text,
          confidence: 0.9,
          is_final: true,
          user_id: user.id
        });
      
      if (error) {
        console.error('Error saving transcript chunk:', error);
      }
    } catch (error) {
      console.error('Error saving transcript chunk:', error);
    }
  };
  
  // Create meeting record
  const createMeeting = async () => {
    if (!user) return null;
    
    try {
      const meetingName = generateMeetingName();
      const startTime = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          title: meetingName,
          description: 'Browser recorded meeting',
          meeting_type: 'general',
          start_time: startTime,
          user_id: user.id,
          status: 'in_progress'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Attach device info in background
      import('@/utils/meetingDeviceCapture').then(({ attachDeviceInfoToMeeting }) => {
        attachDeviceInfoToMeeting(data.id);
      });
      
      return data.id;
    } catch (error) {
      console.error('Error creating meeting:', error);
      showToast.error('Failed to create meeting record', { section: 'meeting_manager' });
      return null;
    }
  };
  
  // Start recording
  const startRecording = async () => {
    try {
      setIsLoading(true);
      setStatus('Connecting...');
      
      // Create meeting record
      const newMeetingId = await createMeeting();
      if (!newMeetingId) {
        throw new Error('Failed to create meeting');
      }
      
      setMeetingId(newMeetingId);
      setSessionId(`browser_${Date.now()}`);
      
      // Initialize transcriber
      transcriberRef.current = new BrowserSpeechTranscriber(
        handleTranscription,
        handleError,
        handleStatusChange
      );
      
      await transcriberRef.current.startTranscription();
      
      // Start duration timer
      const startTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      
      setIsRecording(true);
      setIsLoading(false);
      showToast.success('Browser recording started', { section: 'meeting_manager' });
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      showToast.error('Failed to start browser recording', { section: 'meeting_manager' });
      setIsLoading(false);
      setStatus('Failed to connect');
    }
  };
  
  // Stop recording
  const stopRecording = async () => {
    try {
      setIsLoading(true);
      setStatus('Stopping...');
      
      // Stop transcriber
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
        transcriberRef.current = null;
      }
      
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      // Update meeting record
      if (meetingId) {
        await supabase
          .from('meetings')
          .update({
            end_time: new Date().toISOString(),
            duration_minutes: Math.floor(duration / 60),
            status: 'completed'
          })
          .eq('id', meetingId);
        
        // Save consolidated transcript with detailed error handling
        const consolidatedText = transcriptSegments.map(segment => segment.text).join(' ');
        console.log('Consolidated transcript length:', consolidatedText.length);
        console.log('Meeting ID for transcript:', meetingId);
        console.log('User ID:', user?.id);
        
        if (consolidatedText.trim()) {
          try {
            console.log('Attempting to insert transcript...');
            const { data, error } = await supabase
              .from('meeting_transcripts')
              .insert({
                meeting_id: meetingId,
                content: consolidatedText,
                timestamp_seconds: 0,
                speaker_name: null,
                confidence_score: 0.95
              })
              .select();

            if (error) {
              console.error('Error inserting transcript:', error);
              showToast.error(`Failed to save transcript: ${error.message}`, { section: 'meeting_manager' });
            } else {
              console.log('Transcript inserted successfully:', data);
              
              // Verify the transcript was saved by querying it back
              const { data: verifyData, error: verifyError } = await supabase
                .from('meeting_transcripts')
                .select('id, content')
                .eq('meeting_id', meetingId)
                .limit(1);
              
              if (verifyError) {
                console.error('Error verifying transcript:', verifyError);
                showToast.warning('Transcript may not have been saved properly', { section: 'meeting_manager' });
              } else if (verifyData && verifyData.length > 0) {
                console.log('Transcript verified successfully:', verifyData[0]);
                showToast.success('Transcript saved and verified', { section: 'meeting_manager' });
              } else {
                console.warn('Transcript not found after insert');
                showToast.warning('Transcript may not have been saved', { section: 'meeting_manager' });
              }
            }
          } catch (error) {
            console.error('Exception during transcript insert:', error);
            showToast.error('Failed to save transcript due to unexpected error', { section: 'meeting_manager' });
          }
        } else {
          console.log('No transcript content to save');
          showToast.info('No transcript content was recorded', { section: 'meeting_manager' });
        }
      }
      
      setIsRecording(false);
      setIsLoading(false);
      setStatus('Completed');
      showToast.success('Recording saved successfully', { section: 'meeting_manager' });
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      showToast.error('Error stopping recording', { section: 'meeting_manager' });
      setIsLoading(false);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);
  
  // Get consolidated transcript
  const getConsolidatedTranscript = () => {
    return transcriptSegments.map(segment => segment.text).join(' ');
  };
  
  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Recorder
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Browser Record</h1>
              <p className="text-muted-foreground">Browser-based speech recording with real-time transcription</p>
            </div>
          </div>
          <Badge variant={isRecording ? 'default' : 'secondary'} className="animate-pulse">
            {status}
          </Badge>
        </div>
        
        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Duration Card - Animated */}
          <Card className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className={`w-4 h-4 ${isRecording ? 'animate-pulse text-red-500' : ''}`} />
                Recording Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold text-primary transition-all duration-300 ${isRecording ? 'animate-pulse' : ''}`}>
                {formatDuration(duration)}
              </div>
              {isRecording && (
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent animate-pulse" />
              )}
            </CardContent>
          </Card>
          
          {/* Word Count Card - Progress Ring */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Volume2 className="w-4 h-4" />
                Word Count Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-primary">
                  {wordCount}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Expected: {getExpectedWords(duration)}</span>
                    <span>{getWordProgress().toFixed(0)}%</span>
                  </div>
                  <Progress 
                    value={getWordProgress()} 
                    className="h-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Recording Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recording Controls</span>
              <Badge variant="outline" className="flex items-center gap-1">
                {transcriptSegments.length} segments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  disabled={isLoading}
                  size="lg"
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                  {isLoading ? 'Connecting...' : 'Start Recording'}
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  disabled={isLoading}
                  variant="destructive"
                  size="lg"
                  className="flex items-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                  {isLoading ? 'Stopping...' : 'Stop Recording'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Live Transcript */}
        {(isRecording || liveTranscript) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="w-4 h-4 animate-pulse" />
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted/50 rounded-lg min-h-[80px] border-2 border-dashed border-muted-foreground/20">
                <p className="text-muted-foreground italic min-h-[1.5rem]">
                  {liveTranscript || (isRecording ? 'Listening...' : '')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Transcript Segments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transcript Segments</span>
              <Badge variant="outline">
                {transcriptSegments.length} segments
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {transcriptSegments.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No transcriptions yet. Start recording to see results.
                </p>
              ) : (
                transcriptSegments.map((segment, index) => (
                  <div
                    key={index}
                    className="p-3 bg-card border rounded-lg space-y-2 animate-fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        Segment {index + 1}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {(segment.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed">{segment.text}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Consolidated Transcript */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Consolidated Transcript</span>
              <Badge variant="outline">
                {getConsolidatedTranscript().split(/\s+/).filter(w => w.length > 0).length} total words
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-muted/30 rounded-lg min-h-[200px] max-h-[500px] overflow-y-auto border">
              {getConsolidatedTranscript() ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {getConsolidatedTranscript()}
                </p>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Complete transcript will appear here as you record.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BrowserRecorder;