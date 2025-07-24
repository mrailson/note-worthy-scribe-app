import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History, Search, Trash2, CheckSquare, SquareIcon, Monitor, Volume2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { UnifiedAudioCapture } from "@/utils/UnifiedAudioCapture";

interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

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
  
  // Recording mode selection
  const [recordingMode, setRecordingMode] = useState<'mic-only' | 'mic-browser'>('mic-only');
  
  // Meeting history state
  const [meetings, setMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Search and multi-select state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  // Meeting settings
  const [meetingSettings, setMeetingSettings] = useState(initialSettings || {
    title: "General Meeting",
    description: "",
    meetingType: "general"
  });
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioCaptureRef = useRef<UnifiedAudioCapture | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save meeting data to localStorage
  const autoSaveMeeting = () => {
    if (isRecording && transcript && duration > 5) {
      const meetingData = {
        title: meetingSettings.title || 'General Meeting',
        duration: formatDuration(duration),
        wordCount: wordCount,
        transcript: transcript,
        speakerCount: speakerCount,
        startTime: startTime,
        timestamp: Date.now()
      };
      localStorage.setItem('unsaved_meeting', JSON.stringify(meetingData));
      console.log('Auto-saved meeting data to localStorage');
    }
  };

  // Check for unsaved meeting on component mount
  useEffect(() => {
    const checkUnsavedMeeting = () => {
      const unsavedMeeting = localStorage.getItem('unsaved_meeting');
      if (unsavedMeeting) {
        const meetingData = JSON.parse(unsavedMeeting);
        const age = Date.now() - meetingData.timestamp;
        
        // If unsaved meeting is less than 1 hour old, offer recovery
        if (age < 3600000) {
          const shouldRecover = window.confirm(
            `Found an unsaved meeting recording from ${new Date(meetingData.timestamp).toLocaleString()}. Would you like to recover it?`
          );
          
          if (shouldRecover) {
            navigate('/meeting-summary', { state: meetingData });
            localStorage.removeItem('unsaved_meeting');
          } else {
            localStorage.removeItem('unsaved_meeting');
          }
        } else {
          // Remove old unsaved meetings
          localStorage.removeItem('unsaved_meeting');
        }
      }
    };

    checkUnsavedMeeting();
  }, [navigate]);

  // Auto-save every 30 seconds while recording
  useEffect(() => {
    if (isRecording) {
      autoSaveRef.current = setInterval(autoSaveMeeting, 30000);
      
      // Set up beforeunload event to handle browser close/refresh
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isRecording && duration > 5) {
          autoSaveMeeting();
          e.preventDefault();
          e.returnValue = 'You have an active recording. Are you sure you want to leave?';
          return 'You have an active recording. Are you sure you want to leave?';
        }
      };

      const handleUnload = () => {
        if (isRecording && duration > 5) {
          autoSaveMeeting();
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('unload', handleUnload);
      
      return () => {
        if (autoSaveRef.current) {
          clearInterval(autoSaveRef.current);
        }
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('unload', handleUnload);
      };
    }
  }, [isRecording, duration, transcript, wordCount, speakerCount, startTime, meetingSettings.title]);

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
      console.log(`Starting unified audio capture in ${recordingMode} mode...`);
      
      // Initialize unified audio capture
      audioCaptureRef.current = new UnifiedAudioCapture(
        handleTranscript,
        handleTranscriptionError,
        handleStatusChange
      );
      
      await audioCaptureRef.current.startCapture(recordingMode);
      
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

      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording: ' + error.message);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stopCapture();
      audioCaptureRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Clear auto-save interval and localStorage
    if (autoSaveRef.current) {
      clearInterval(autoSaveRef.current);
    }
    localStorage.removeItem('unsaved_meeting');
    
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
          created_at,
          location,
          format,
          meeting_overviews (
            overview
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get transcript counts and summaries for each meeting
      const meetingsWithCounts = await Promise.all(
        (meetingsData || []).map(async (meeting) => {
          const { count } = await supabase
            .from('meeting_transcripts')
            .select('*', { count: 'exact', head: true })
            .eq('meeting_id', meeting.id);

          const { data: summaryData } = await supabase
            .from('meeting_summaries')
            .select('summary')
            .eq('meeting_id', meeting.id)
            .maybeSingle();

          const meetingWithOverview = {
            ...meeting,
            transcript_count: count || 0,
            summary_exists: !!summaryData?.summary,
            meeting_summary: summaryData?.summary || null,
            overview: meeting.meeting_overviews?.overview || null
          };
          
          // Debug log to check overview data
          console.log('Meeting with overview:', {
            id: meeting.id,
            title: meeting.title,
            overview: meetingWithOverview.overview,
            rawOverviews: meeting.meeting_overviews
          });
          
          return meetingWithOverview;
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

  // Filter meetings based on search query
  useEffect(() => {
    let filtered = meetings;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = meetings.filter(meeting =>
        meeting.title.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query) ||
        meeting.meeting_type.toLowerCase().includes(query)
      );
    }
    
    setFilteredMeetings(filtered);
  }, [meetings, searchQuery]);

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

  // Multi-select handlers
  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

  const handleSelectAll = () => {
    if (selectedMeetings.length === filteredMeetings.length) {
      setSelectedMeetings([]);
    } else {
      setSelectedMeetings(filteredMeetings.map(m => m.id));
    }
  };

  const handleDeleteSelected = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', selectedMeetings)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success(`${selectedMeetings.length} meetings deleted successfully`);
      
      setSelectedMeetings([]);
      setIsSelectMode(false);
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error deleting selected meetings:", error.message);
      toast.error("Failed to delete selected meetings");
    }
  };

  const handleDeleteAll = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success("All meetings deleted successfully");
      
      setDeleteConfirmation("");
      setSelectedMeetings([]);
      setIsSelectMode(false);
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error deleting all meetings:", error.message);
      toast.error("Failed to delete all meetings");
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
          <div className="space-y-6">
            {/* Stats Dashboard */}
            <Card className="bg-gradient-to-br from-background to-muted/30 border-2">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* Duration */}
                  <div className="text-center p-4 bg-background/50 rounded-xl border border-border/50 shadow-sm">
                    <div className="text-3xl lg:text-4xl font-bold text-primary mb-1">
                      {formatDuration(duration)}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Duration</div>
                  </div>
                  
                  {/* Word Count */}
                  <div className="text-center p-4 bg-background/50 rounded-xl border border-border/50 shadow-sm">
                    <div className="text-3xl lg:text-4xl font-bold text-primary mb-1">
                      {wordCount}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">Words</div>
                  </div>
                  
                  {/* Connection Status */}
                  <div className="col-span-2 lg:col-span-1 flex items-center justify-center p-4 bg-background/50 rounded-xl border border-border/50 shadow-sm">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1 text-sm px-3 py-1">
                          {getConnectionStatusIcon()}
                          <span>{connectionStatus}</span>
                        </Badge>
                      </div>
                      <div className="text-sm font-medium text-muted-foreground">Connection</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recording Controls */}
            <Card className="shadow-lg border-2">
              <CardContent className="pt-6">
                {/* Recording Mode Selection */}
                {!isRecording && (
                  <div className="mb-8">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-semibold mb-2">Recording Mode</h3>
                      <p className="text-sm text-muted-foreground">Choose how you want to capture audio</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                      <Button
                        variant={recordingMode === 'mic-only' ? 'default' : 'outline'}
                        onClick={() => setRecordingMode('mic-only')}
                        className={`flex flex-col items-center gap-3 h-auto py-6 px-6 border-2 transition-all duration-200 ${
                          recordingMode === 'mic-only' 
                            ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-105' 
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="p-3 rounded-full bg-primary/10">
                          <Mic className="h-6 w-6" />
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-base">Microphone Only</div>
                          <div className="text-sm opacity-80 mt-1">Face to face meetings</div>
                        </div>
                      </Button>
                      
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={recordingMode === 'mic-browser' ? 'default' : 'outline'}
                            onClick={() => setRecordingMode('mic-browser')}
                            className={`flex flex-col items-center gap-3 h-auto py-6 px-6 border-2 transition-all duration-200 ${
                              recordingMode === 'mic-browser' 
                                ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-105' 
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            <div className="p-3 rounded-full bg-primary/10 flex items-center gap-2">
                              <Mic className="h-5 w-5" />
                              <Volume2 className="h-5 w-5" />
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-base">Mic + Browser Audio</div>
                              <div className="text-sm opacity-80 mt-1">Teams, Zoom meetings</div>
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>You'll be asked to share your browser tab to capture system audio</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}

                {/* Recording Button */}
                <div className="text-center">
                  {!isRecording ? (
                    <div className="space-y-4">
                      <Button 
                        onClick={startRecording}
                        size="lg"
                        className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-12 py-6 text-lg font-semibold rounded-xl"
                      >
                        <Mic className="h-6 w-6 mr-3" />
                        Start Recording
                      </Button>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto">
                        Click to begin recording with real-time transcription. Make sure you're in a quiet environment for best results.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-center gap-3 text-primary animate-pulse bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6 border border-primary/20">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-lg font-semibold">Recording in progress...</span>
                      </div>
                      
                      <Button 
                        onClick={stopRecording}
                        variant="destructive"
                        size="lg"
                        className="shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 px-12 py-6 text-lg font-semibold rounded-xl"
                      >
                        <Square className="h-6 w-6 mr-3" />
                        Stop Recording
                      </Button>
                    </div>
                  )}
                </div>

                {/* Welcome Message */}
                {!isRecording && (
                  <div className="text-center py-8 mt-8 border-t border-border/50">
                    <div className="max-w-md mx-auto">
                      <div className="p-4 rounded-full bg-primary/5 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <Mic className="h-10 w-10 text-primary/60" />
                      </div>
                      <h3 className="text-xl font-semibold mb-3 text-foreground">Ready to Record</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        Your meeting will be transcribed in real-time with speaker identification and timestamping.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                  {realtimeTranscripts
                    .slice()
                    .reverse()
                    .map((transcript, index) => (
                    <div
                      key={`${transcript.speaker}-${realtimeTranscripts.length - 1 - index}`}
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
            <CardContent className="space-y-4">
              {/* Search Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search meetings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {filteredMeetings.length > 0 && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {filteredMeetings.length} meeting{filteredMeetings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Multi-select and Delete Controls */}
              {meetings.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Multi-select controls */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsSelectMode(!isSelectMode);
                        setSelectedMeetings([]);
                      }}
                      className="touch-manipulation min-h-[44px]"
                    >
                      {isSelectMode ? (
                        <>
                          <SquareIcon className="h-4 w-4 mr-2" />
                          Cancel Selection
                        </>
                      ) : (
                        <>
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Select Multiple
                        </>
                      )}
                    </Button>
                    
                    {isSelectMode && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAll}
                          className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                        >
                          {selectedMeetings.length === filteredMeetings.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        
                        {selectedMeetings.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {selectedMeetings.length} selected
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Delete actions */}
                  <div className="flex gap-2">
                    {isSelectMode && selectedMeetings.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Selected ({selectedMeetings.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="mx-4 max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Selected Meetings</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              This action will permanently delete {selectedMeetings.length} meeting{selectedMeetings.length > 1 ? 's' : ''}, their transcripts, and summaries. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel className="touch-manipulation min-h-[44px]">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleDeleteSelected}
                              className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                            >
                              Delete Selected
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {meetings.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            className="touch-manipulation min-h-[44px] text-xs sm:text-sm"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete All
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="mx-4 max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete All Meetings</AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              This action will permanently delete all {meetings.length} meetings, their transcripts, and summaries. This cannot be undone.
                              <br /><br />
                              To confirm, please type <strong>delete</strong> in the field below:
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <Input
                            placeholder="Type 'delete' to confirm"
                            value={deleteConfirmation}
                            onChange={(e) => setDeleteConfirmation(e.target.value)}
                            className="touch-manipulation min-h-[44px]"
                          />
                          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel 
                              onClick={() => setDeleteConfirmation("")}
                              className="touch-manipulation min-h-[44px]"
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleDeleteAll}
                              disabled={deleteConfirmation.toLowerCase() !== 'delete'}
                              className="bg-destructive hover:bg-destructive/90 touch-manipulation min-h-[44px]"
                            >
                              Delete All Meetings
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              )}

              {/* Meeting List */}
              <MeetingHistoryList
                meetings={filteredMeetings}
                onEdit={handleEditMeeting}
                onViewSummary={handleViewSummary}
                onDelete={handleDeleteMeeting}
                loading={loadingHistory}
                isSelectMode={isSelectMode}
                selectedMeetings={selectedMeetings}
                onSelectMeeting={handleSelectMeeting}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};