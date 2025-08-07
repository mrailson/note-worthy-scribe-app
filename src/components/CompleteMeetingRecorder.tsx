import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mic, 
  MicOff, 
  Square, 
  Play, 
  Pause, 
  Save, 
  Download, 
  FileText, 
  Clock,
  Users,
  Settings,
  Volume2,
  VolumeX,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MeetingDocuments } from '@/components/MeetingDocuments';

interface TranscriptSegment {
  id: string;
  timestamp: string;
  text: string;
  speaker?: string;
  confidence?: number;
}

interface MeetingSettings {
  title: string;
  description: string;
  meetingType: string;
  location: string;
  attendees: string[];
  isPrivate: boolean;
}

export const CompleteMeetingRecorder: React.FC = () => {
  const { user } = useAuth();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedMeetingId, setSavedMeetingId] = useState<string | null>(null);

  // Audio state
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Transcript state
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptConfidence, setTranscriptConfidence] = useState(0);

  // Meeting settings
  const [settings, setSettings] = useState<MeetingSettings>({
    title: `Meeting ${new Date().toLocaleDateString()}`,
    description: '',
    meetingType: 'general',
    location: '',
    attendees: [],
    isPrivate: false
  });

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Initialize audio context and analyzer
  const initializeAudioAnalysis = useCallback(async () => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    } catch (error) {
      console.error('Error initializing audio analysis:', error);
    }
  }, []);

  // Update audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
    setAudioLevel(average / 255);
  }, []);

  // Initialize WebSocket connection
  const initializeWebSocket = useCallback(() => {
    const wsUrl = `wss://dphcnbricafkbtizkoal.functions.supabase.co/realtime-transcription-ws`;
    websocketRef.current = new WebSocket(wsUrl);

    websocketRef.current.onopen = () => {
      console.log('WebSocket connected');
      toast.success('Real-time transcription connected');
    };

    websocketRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'session_started':
          console.log('Session started:', data.sessionId);
          break;
        case 'transcription':
          const newSegment: TranscriptSegment = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date().toLocaleTimeString(),
            text: data.text,
            confidence: data.confidence || 0.95
          };
          setTranscript(prev => [...prev, newSegment]);
          setLiveTranscript(data.text);
          break;
        case 'error':
          console.error('WebSocket error:', data.message);
          toast.error('Transcription error: ' + data.message);
          break;
      }
    };

    websocketRef.current.onclose = () => {
      console.log('WebSocket disconnected');
      if (isRecording) {
        toast.warning('Transcription connection lost');
      }
    };

    websocketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('Transcription connection failed');
    };
  }, [isRecording]);

  // Start recording
  const startRecording = async () => {
    try {
      setIsProcessing(true);
      
      // Request microphone access
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

      // Initialize audio analysis
      await initializeAudioAnalysis();
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      }

      // Initialize WebSocket
      initializeWebSocket();

      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          
          // Convert to base64 and send to WebSocket for transcription
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              websocketRef.current?.send(JSON.stringify({
                type: 'audio_chunk',
                audio: base64,
                sessionId: sessionId
              }));
            };
            reader.readAsDataURL(event.data);
          }
        }
      };

      // Generate session ID
      const newSessionId = crypto.randomUUID();
      setSessionId(newSessionId);

      // Start session
      setTimeout(() => {
        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'start_session',
            sessionId: newSessionId
          }));
        }
      }, 1000);

      // Start recording
      mediaRecorder.start(3000); // Send chunks every 3 seconds
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start audio level monitoring
      audioLevelIntervalRef.current = setInterval(updateAudioLevel, 100);

      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      setIsProcessing(true);

      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (websocketRef.current) {
        websocketRef.current.send(JSON.stringify({
          type: 'end_session',
          sessionId: sessionId
        }));
        websocketRef.current.close();
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
      }

      setIsRecording(false);
      setIsPaused(false);
      setAudioLevel(0);

      toast.success('Recording stopped');
    } catch (error) {
      console.error('Error stopping recording:', error);
      toast.error('Error stopping recording');
    } finally {
      setIsProcessing(false);
    }
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        durationIntervalRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        toast.success('Recording resumed');
      } else {
        mediaRecorderRef.current.pause();
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
        toast.success('Recording paused');
      }
      setIsPaused(!isPaused);
    }
  };

  // Save meeting
  const saveMeeting = async () => {
    if (!user) {
      toast.error('Please log in to save meetings');
      return;
    }

    try {
      setIsSaving(true);

      // Save meeting metadata
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: settings.title,
          description: settings.description,
          meeting_type: settings.meetingType,
          location: settings.location,
          start_time: new Date(Date.now() - recordingDuration * 1000).toISOString(),
          end_time: new Date().toISOString(),
          duration_minutes: Math.round(recordingDuration / 60),
          status: 'completed',
          session_id: sessionId
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Save transcript segments
      if (transcript.length > 0) {
        const transcriptData = transcript.map((segment, index) => ({
          meeting_id: meeting.id,
          content: segment.text,
          speaker_name: segment.speaker || 'Unknown',
          timestamp_seconds: index * 3, // Approximate timing
          confidence_score: segment.confidence || 0.95
        }));

        const { error: transcriptError } = await supabase
          .from('meeting_transcripts')
          .insert(transcriptData);

        if (transcriptError) {
          console.error('Error saving transcript:', transcriptError);
        }
      }

      setSavedMeetingId(meeting.id);
      toast.success('Meeting saved successfully');
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    } finally {
      setIsSaving(false);
    }
  };

  // Generate AI summary
  const generateSummary = async () => {
    if (!savedMeetingId || transcript.length === 0) {
      toast.error('Please save the meeting first');
      return;
    }

    try {
      setIsGeneratingSummary(true);

      const fullTranscript = transcript.map(segment => segment.text).join(' ');

      const { data, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: {
          transcript: fullTranscript,
          meetingTitle: settings.title,
          meetingType: settings.meetingType
        }
      });

      if (error) throw error;

      // Save summary
      await supabase
        .from('meeting_summaries')
        .insert({
          meeting_id: savedMeetingId,
          summary: data.meetingMinutes,
          ai_generated: true
        });

      toast.success('AI summary generated successfully');
    } catch (error) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate summary');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mic className="h-6 w-6" />
              Complete Meeting Recorder
            </span>
            {isRecording && (
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-2"></div>
                Recording
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Recording Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recording Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Controls */}
              <div className="flex gap-2">
                {!isRecording ? (
                  <Button 
                    onClick={startRecording} 
                    disabled={isProcessing}
                    className="flex-1"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <>
                    <Button 
                      onClick={togglePause}
                      variant="outline"
                      disabled={isProcessing}
                    >
                      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button 
                      onClick={stopRecording}
                      variant="destructive"
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>

              {/* Duration */}
              <div className="flex items-center justify-center gap-2 text-2xl font-mono">
                <Clock className="h-5 w-5" />
                {formatDuration(recordingDuration)}
              </div>

              {/* Audio Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Audio Level</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-150"
                    style={{ width: `${audioLevel * 100}%` }}
                  />
                </div>
              </div>

              {/* Actions */}
              <Separator />
              <div className="space-y-2">
                <Button 
                  onClick={saveMeeting}
                  disabled={isSaving || !transcript.length}
                  className="w-full"
                  variant="outline"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Meeting'}
                </Button>

                <Button 
                  onClick={generateSummary}
                  disabled={isGeneratingSummary || !savedMeetingId}
                  className="w-full"
                  variant="outline"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {isGeneratingSummary ? 'Generating...' : 'Generate AI Summary'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Meeting Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Meeting Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Meeting Title</Label>
                <Input
                  id="title"
                  value={settings.title}
                  onChange={(e) => setSettings(prev => ({ ...prev, title: e.target.value }))}
                  disabled={isRecording}
                />
              </div>

              <div>
                <Label htmlFor="type">Meeting Type</Label>
                <Select
                  value={settings.meetingType}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, meetingType: value }))}
                  disabled={isRecording}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Meeting</SelectItem>
                    <SelectItem value="consultation">Patient Consultation</SelectItem>
                    <SelectItem value="team">Team Meeting</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="training">Training Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={settings.location}
                  onChange={(e) => setSettings(prev => ({ ...prev, location: e.target.value }))}
                  disabled={isRecording}
                  placeholder="e.g., Conference Room A"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isRecording}
                  placeholder="Meeting agenda or description..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Transcript */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Live Transcript
                </span>
                <Badge variant="outline">
                  {transcript.length} segments
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full" ref={scrollAreaRef}>
                <div className="space-y-3">
                  {transcript.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      {isRecording ? 'Listening for speech...' : 'Start recording to see live transcript'}
                    </div>
                  ) : (
                    transcript.map((segment, index) => (
                      <div key={segment.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {segment.timestamp}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">{segment.text}</p>
                          {segment.confidence && (
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-16 bg-muted rounded-full h-1">
                                <div 
                                  className="bg-primary h-1 rounded-full"
                                  style={{ width: `${segment.confidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(segment.confidence * 100)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {/* Live segment */}
                  {liveTranscript && (
                    <div className="flex gap-3 p-3 bg-primary/10 rounded-lg border-l-2 border-primary">
                      <div className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                        {new Date().toLocaleTimeString()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-primary">{liveTranscript}</p>
                        <Badge variant="secondary" className="text-xs mt-1">
                          Processing...
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Meeting Documents */}
          {savedMeetingId && (
            <MeetingDocuments 
              meetingId={savedMeetingId} 
              meetingTitle={settings.title}
            />
          )}
        </div>
      </div>
    </div>
  );
};