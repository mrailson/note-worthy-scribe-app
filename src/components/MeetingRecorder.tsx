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
import { useAuth } from '@/contexts/AuthContext';
import { useRecordingManager } from '@/components/meeting-recorder-v2/hooks/useRecordingManager';

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

const AudioVisualizer: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <div className="flex items-center justify-center space-x-1 h-8">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={`w-1 bg-primary rounded-full transition-all duration-150 ${
            isActive ? 'animate-pulse' : 'h-2'
          }`}
          style={{
            height: isActive ? `${Math.random() * 24 + 8}px` : '8px',
            animationDelay: `${i * 100}ms`
          }}
        />
      ))}
    </div>
  );
};

const RecordingSettings: React.FC<{
  settings: any;
  onSettingsChange: (settings: any) => void;
}> = ({ settings, onSettingsChange }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Meeting Type</label>
        <Input
          value={settings.meetingType || 'general'}
          onChange={(e) => onSettingsChange({ ...settings, meetingType: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Transcriber Service</label>
        <select
          value={settings.transcriberService || 'whisper'}
          onChange={(e) => onSettingsChange({ ...settings, transcriberService: e.target.value })}
          className="w-full p-2 border rounded-md"
        >
          <option value="whisper">Whisper</option>
          <option value="deepgram">Deepgram</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={settings.description || ''}
          onChange={(e) => onSettingsChange({ ...settings, description: e.target.value })}
          placeholder="Meeting description..."
        />
      </div>
    </div>
  );
};

const TranscriptionDisplay: React.FC<{
  transcript: string;
  isRecording: boolean;
  realtimeTranscripts?: any[];
}> = ({ transcript, isRecording, realtimeTranscripts = [] }) => {
  return (
    <div className="space-y-4">
      {transcript ? (
        <div className="min-h-[300px] p-4 bg-muted rounded-lg">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{transcript}</p>
        </div>
      ) : (
        <div className="min-h-[300px] p-4 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
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
      
      {realtimeTranscripts.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Processed {realtimeTranscripts.length} transcript segments
        </div>
      )}
    </div>
  );
};

const MeetingNotes: React.FC<{ meetingId: string | null }> = ({ meetingId }) => {
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateNotes = async () => {
    if (!meetingId) return;
    
    setIsGenerating(true);
    try {
      // This would integrate with your notes generation system
      toast.success('Notes generation started');
    } catch (error) {
      toast.error('Failed to generate notes');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Meeting Notes</h3>
        <Button 
          onClick={generateNotes}
          disabled={!meetingId || isGenerating}
          size="sm"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate Notes'
          )}
        </Button>
      </div>
      
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Meeting notes will appear here..."
        className="min-h-[200px]"
      />
    </div>
  );
};

export const MeetingRecorder: React.FC<MeetingRecorderProps> = ({ 
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}) => {
  const { user } = useAuth();
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState(initialSettings?.title || '');

  const {
    state,
    settings,
    setSettings,
    startRecording,
    stopRecording,
    resetRecording,
    formatDuration
  } = useRecordingManager(
    onTranscriptUpdate,
    onDurationUpdate,
    onWordCountUpdate,
    initialSettings
  );

  // Create new meeting when recording starts
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
      return data.id;
    } catch (error) {
      console.error('Failed to create meeting:', error);
      toast.error('Failed to create meeting');
      return null;
    }
  };

  const handleStartRecording = async () => {
    if (!meetingTitle.trim()) {
      toast.error('Please enter a meeting title');
      return;
    }

    // Create meeting record
    const newMeetingId = await createMeeting(meetingTitle);
    if (newMeetingId) {
      setMeetingId(newMeetingId);
    }

    // Start the actual recording
    await startRecording();
  };

  const handleStopRecording = async () => {
    await stopRecording();
    // Meeting will be automatically updated by the recording manager
  };

  const getStatusBadgeVariant = () => {
    if (state.isRecording) return 'destructive';
    if (state.isStoppingRecording) return 'secondary';
    return 'outline';
  };

  const getStatusText = () => {
    if (state.isStoppingRecording) return 'Stopping';
    if (state.isRecording) return 'Recording';
    return 'Idle';
  };

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
                      {getStatusText()}
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
              {!state.isRecording && (
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

              {/* Audio Visualizer */}
              <AudioVisualizer isActive={state.isRecording} />

              {/* Timer and Stats */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl font-mono font-bold">
                    {formatDuration(state.duration)}
                  </div>
                  {state.wordCount > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {state.wordCount} words • {state.speakerCount} speakers
                    </div>
                  )}
                </div>
                
                {/* Connection Status */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-muted-foreground">
                    {state.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-2">
                {!state.isRecording && (
                  <Button
                    onClick={handleStartRecording}
                    disabled={!meetingTitle.trim() || state.isStoppingRecording}
                    className="flex-1"
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Start Recording
                  </Button>
                )}
                
                {state.isRecording && (
                  <Button
                    onClick={handleStopRecording}
                    variant="destructive"
                    disabled={state.isStoppingRecording}
                    className="flex-1"
                  >
                    {state.isStoppingRecording ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Stopping...
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Stop Recording
                      </>
                    )}
                  </Button>
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
              <TranscriptionDisplay
                transcript={state.transcript}
                isRecording={state.isRecording}
                realtimeTranscripts={state.realtimeTranscripts}
              />
            </CardContent>
          </Card>

          {/* Meeting Notes Section */}
          {meetingId && (
            <Card>
              <CardHeader>
                <CardTitle>Meeting Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <MeetingNotes meetingId={meetingId} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recording Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordingSettings
                settings={settings}
                onSettingsChange={setSettings}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};