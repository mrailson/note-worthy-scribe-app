import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History } from "lucide-react";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { RealtimeTranscriber, TranscriptData } from "@/utils/RealtimeTranscriber";

interface MeetingRecorderProps {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const MeetingRecorder = ({ 
  onTranscriptUpdate, 
  onDurationUpdate, 
  onWordCountUpdate,
  initialSettings
}: MeetingRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [speakerCount, setSpeakerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [startTime, setStartTime] = useState<string>("");
  
  // Meeting history state
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Meeting settings
  const [meetingSettings, setMeetingSettings] = useState(initialSettings || {
    title: "General Meeting",
    description: "",
    meetingType: "general"
  });
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transciberRef = useRef<RealtimeTranscriber | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTranscript = (transcriptData: TranscriptData) => {
    // Update transcripts array
    setRealtimeTranscripts(prev => {
      const filtered = prev.filter(t => 
        !(t.speaker === transcriptData.speaker && !t.isFinal)
      );
      const newTranscripts = [...filtered, transcriptData];
      
      // Calculate speaker count from the new array
      const speakers = new Set(newTranscripts.map(t => t.speaker));
      setSpeakerCount(speakers.size);
      
      // Update main transcript if this is final
      if (transcriptData.isFinal) {
        const finalTranscripts = newTranscripts.filter(t => t.isFinal);
        const fullTranscript = finalTranscripts
          .map(t => `${t.speaker}: ${t.text}`)
          .join('\n');
        
        setTranscript(fullTranscript);
        onTranscriptUpdate(fullTranscript);
        
        // Update word count
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
        onWordCountUpdate(words.length);
      }
      
      return newTranscripts;
    });
  };

  const handleTranscriptionError = (error: string) => {
    console.error("Transcription Error:", error);
    setConnectionStatus("Error");
  };

  const handleStatusChange = (status: string) => {
    // Use a more robust approach to avoid state updates during render
    queueMicrotask(() => setConnectionStatus(status));
  };

  const startRecording = async () => {
    try {
      // Initialize real-time transcriber
      transciberRef.current = new RealtimeTranscriber(
        handleTranscript,
        handleTranscriptionError,
        handleStatusChange
      );
      
      await transciberRef.current.startTranscription();
      
      setIsRecording(true);
      setRealtimeTranscripts([]);
      setSpeakerCount(0);
      setStartTime(new Date().toISOString());
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          const minutes = Math.floor(newDuration / 60);
          const seconds = newDuration % 60;
          const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
          onDurationUpdate(timeString);
          return newDuration;
        });
      }, 1000);

    } catch (error) {
      // Silent error handling - could add console.log if needed for debugging
    }
  };

  const stopRecording = () => {
    if (transciberRef.current) {
      transciberRef.current.stopTranscription();
      transciberRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setIsRecording(false);
    
    // Check if recording has at least 5 seconds of content
    if (duration < 5) {
      // Silent validation - just return without saving
      return;
    }

    // Check if there's meaningful transcript content
    if (!transcript || transcript.trim().length < 10) {
      // Silent validation - just return without saving
      return;
    }
    
    // Navigate to meeting summary with data
    const meetingData = {
      title: initialSettings?.title || 'General Meeting',
      duration: formatDuration(duration),
      wordCount: wordCount,
      transcript: transcript,
      speakerCount: speakerCount,
      startTime: startTime
    };

    navigate('/meeting-summary', { state: meetingData });
    
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Load meeting history
  const loadMeetingHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    try {
      const { data: meetingsData, error } = await supabase
        .from('meetings')
        .select(`
          id,
          title,
          description,
          meeting_type,
          start_time,
          end_time,
          duration_minutes,
          status,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get transcript counts for each meeting
      const meetingsWithCounts = await Promise.all(
        (meetingsData || []).map(async (meeting) => {
          const { count } = await supabase
            .from('meeting_transcripts')
            .select('*', { count: 'exact', head: true })
            .eq('meeting_id', meeting.id);

          const { data: summaryData } = await supabase
            .from('meeting_summaries')
            .select('id')
            .eq('meeting_id', meeting.id)
            .single();

          return {
            ...meeting,
            transcript_count: count || 0,
            summary_exists: !!summaryData
          };
        })
      );

      setMeetings(meetingsWithCounts);
    } catch (error) {
      console.error('Error loading meeting history:', error);
      toast.error('Failed to load meeting history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load history when user changes or component mounts
  useEffect(() => {
    if (user) {
      loadMeetingHistory();
    }
  }, [user]);

  // Meeting history handlers
  const handleEditMeeting = (meetingId: string) => {
    navigate(`/meeting-summary`, { state: { id: meetingId } });
  };

  const handleViewSummary = (meetingId: string) => {
    navigate(`/meeting-summary`, { state: { id: meetingId } });
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      // Delete transcripts first
      await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete summaries
      await supabase
        .from('meeting_summaries')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete meeting
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;

      toast.success('Meeting deleted successfully');
      loadMeetingHistory(); // Reload the list
    } catch (error) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    }
  };

  // Settings handlers
  const handleSettingsChange = (newSettings: any) => {
    setMeetingSettings(newSettings);
  };

  return (
    <div className="space-y-6">
      {/* Tabbed Interface */}
      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recorder" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Meeting Recorder</span>
            <span className="sm:hidden">Record</span>
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Live Transcript</span>
            <span className="sm:hidden">Transcript</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Meeting Settings</span>
            <span className="sm:hidden">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Meeting History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Meeting Recorder Tab - ONLY recording controls */}
        <TabsContent value="recorder" className="space-y-6 mt-6">
          <Card className="shadow-medium border-accent/20">
            <CardContent className="space-y-6 pt-6">
              {/* Recording Controls and Stats with Connection Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="bg-accent/20 rounded-lg p-4">
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{formatDuration(duration)}</div>
                  <div className="text-sm text-muted-foreground">Duration</div>
                </div>
                <div className="bg-accent/20 rounded-lg p-4">
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{wordCount}</div>
                  <div className="text-sm text-muted-foreground">Words</div>
                </div>
                <div className="bg-accent/20 rounded-lg p-4">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1 text-xs">
                      {getConnectionStatusIcon()}
                      <span className="hidden sm:inline">{connectionStatus}</span>
                    </Badge>
                    <div className="text-sm text-muted-foreground">Connection</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                {!isRecording ? (
                  <Button 
                    onClick={startRecording}
                    className="bg-gradient-primary hover:bg-primary-hover shadow-subtle w-full sm:w-auto px-8 py-4 text-lg font-medium touch-manipulation min-h-[56px]"
                  >
                    <Mic className="h-5 w-5 mr-3" />
                    Start Recording
                  </Button>
                ) : (
                  <Button 
                    onClick={stopRecording}
                    variant="destructive"
                    className="shadow-subtle w-full sm:w-auto px-8 py-4 text-lg font-medium touch-manipulation min-h-[56px]"
                  >
                    <Square className="h-5 w-5 mr-3" />
                    Stop Recording
                  </Button>
                )}
              </div>

              {isRecording && (
                <div className="flex items-center justify-center gap-3 text-primary animate-pulse bg-accent/20 rounded-lg p-4">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span className="text-base font-medium">Recording with real-time transcription...</span>
                </div>
              )}

              {/* Basic info when not recording */}
              {!isRecording && (
                <div className="text-center py-8 text-muted-foreground">
                  <Mic className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Ready to Record</h3>
                  <p className="text-sm">Click "Start Recording" to begin capturing your meeting with real-time transcription.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live Transcript Tab */}
        <TabsContent value="transcript" className="space-y-4 mt-6">
          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Live Meeting Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {realtimeTranscripts.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {realtimeTranscripts.map((transcript, index) => (
                    <div
                      key={`${transcript.speaker}-${index}`}
                      className={`p-3 rounded-lg border ${
                        transcript.isFinal
                          ? 'bg-accent/20 border-accent/40'
                          : 'bg-muted/50 border-muted animate-pulse'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {transcript.speaker}
                        </Badge>
                        {!transcript.isFinal && (
                          <Badge variant="secondary" className="text-xs">
                            Live
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed">
                        {transcript.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Start recording to see live transcript here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meeting Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-6">
          <MeetingSettings
            onSettingsChange={handleSettingsChange}
            initialSettings={meetingSettings}
          />
        </TabsContent>

        {/* Meeting History Tab */}
        <TabsContent value="history" className="space-y-4 mt-6">
          <Card className="border-accent/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                My Meeting History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingHistoryList
                meetings={meetings}
                onEdit={handleEditMeeting}
                onViewSummary={handleViewSummary}
                onDelete={handleDeleteMeeting}
                loading={loadingHistory}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};