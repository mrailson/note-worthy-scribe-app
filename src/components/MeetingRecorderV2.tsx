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
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History, Search, Trash2, CheckSquare, SquareIcon, Monitor, Volume2, Waves, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";
import { TranscriptionTest } from "@/components/TranscriptionTest";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { DeepgramRealtimeTranscriber, TranscriptData as DeepgramTranscriptData } from '@/utils/DeepgramRealtimeTranscriber';
import { WebSpeechTranscriber } from '@/utils/WebSpeechTranscriber';

interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface MeetingRecorderV2Props {
  onTranscriptUpdate: (transcript: string) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const MeetingRecorderV2 = ({ 
  onTranscriptUpdate, 
  onDurationUpdate, 
  onWordCountUpdate,
  initialSettings
}: MeetingRecorderV2Props) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [speakerCount, setSpeakerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [startTime, setStartTime] = useState<string>("");
  const [liveSummary, setLiveSummary] = useState<string>("");
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [testTranscripts, setTestTranscripts] = useState<string[]>([]);
  const [selectedTranscriber, setSelectedTranscriber] = useState<'browser' | 'webspeech'>('webspeech');
  
  // Meeting history state
  const [meetings, setMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Search and multi-select state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  
  // Meeting settings
  const [meetingSettings, setMeetingSettings] = useState(initialSettings || {
    title: "General Meeting V2",
    description: "",
    meetingType: "general"
  });
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const browserAudioStreamRef = useRef<MediaStream | null>(null);
  const micAudioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const deepgramTranscriberRef = useRef<DeepgramRealtimeTranscriber | null>(null);
  const webSpeechTranscriberRef = useRef<WebSpeechTranscriber | null>(null);

  // Auto-save meeting data to localStorage
  const autoSaveMeeting = () => {
    if (isRecording && transcript && duration > 5) {
      const meetingData = {
        title: meetingSettings.title || 'General Meeting V2',
        duration: formatDuration(duration),
        wordCount: wordCount,
        transcript: transcript,
        speakerCount: speakerCount,
        startTime: startTime,
        timestamp: Date.now()
      };
      localStorage.setItem('unsaved_meeting_v2', JSON.stringify(meetingData));
      console.log('Auto-saved meeting data to localStorage (V2)');
    }
  };

  // Check for unsaved meeting on component mount
  useEffect(() => {
    const checkUnsavedMeeting = () => {
      const unsavedMeeting = localStorage.getItem('unsaved_meeting_v2');
      if (unsavedMeeting) {
        const meetingData = JSON.parse(unsavedMeeting);
        const age = Date.now() - meetingData.timestamp;
        
        // If unsaved meeting is less than 1 hour old, offer recovery
        if (age < 3600000) {
          const shouldRecover = window.confirm(
            `Found an unsaved meeting recording V2 from ${new Date(meetingData.timestamp).toLocaleString()}. Would you like to recover it?`
          );
          
          if (shouldRecover) {
            navigate('/meeting-summary', { state: meetingData });
            localStorage.removeItem('unsaved_meeting_v2');
          } else {
            localStorage.removeItem('unsaved_meeting_v2');
          }
        } else {
          // Remove old unsaved meetings
          localStorage.removeItem('unsaved_meeting_v2');
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

  const handleDeepgramTranscript = (data: DeepgramTranscriptData) => {
    const transcriptData: TranscriptData = {
      text: data.text,
      speaker: data.speaker || 'Speaker 1',
      confidence: data.confidence,
      timestamp: new Date().toISOString(),
      isFinal: data.is_final
    };
    
    addDebugLog(`🎙️ ${data.is_final ? 'Final' : 'Interim'}: "${data.text}" (${Math.round(data.confidence * 100)}%)`);
    setTestTranscripts(prev => [...prev.slice(-9), `${data.speaker || 'Speaker'}: ${data.text}`]);
    
    handleTranscript(transcriptData);
  };

  const handleTranscriptionError = (error: string) => {
    console.error("Transcription Error:", error);
    setConnectionStatus("Error");
    addDebugLog(`❌ Error: ${error}`);
  };

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLog(prev => [...prev.slice(-19), logEntry]); // Keep last 20 entries
    console.log(logEntry);
  };

  const handleStatusChange = (status: string) => {
    // Use a more robust approach to avoid state updates during render
    queueMicrotask(() => {
      setConnectionStatus(status);
      addDebugLog(`🔄 Status: ${status}`);
    });
  };

  const handleLiveSummary = (summary: string) => {
    setLiveSummary(summary);
    addDebugLog(`📄 Summary generated (${summary.length} chars)`);
    toast.success("Live summary updated!");
  };

  const startWebSpeechTranscription = async () => {
    addDebugLog('🌐 Starting Web Speech API transcription...');
    
    const transcriber = new WebSpeechTranscriber(
      handleDeepgramTranscript,
      handleTranscriptionError,
      handleStatusChange,
      handleLiveSummary
    );

    await transcriber.startTranscription();
    webSpeechTranscriberRef.current = transcriber;
    setIsRecording(true);
    setStartTime(new Date().toISOString());
    
    addDebugLog('✅ Web Speech API recording started successfully');
    console.log('Recording started with Web Speech API');
  };

  const startBrowserTranscription = async () => {
    addDebugLog('🎤 Starting browser speech recognition...');
    
    const transcriber = new DeepgramRealtimeTranscriber(
      handleDeepgramTranscript,
      handleTranscriptionError,
      handleStatusChange,
      handleLiveSummary
    );

    await transcriber.startTranscription();
    deepgramTranscriberRef.current = transcriber;
    setIsRecording(true);
    setStartTime(new Date().toISOString());
    
    addDebugLog('✅ Browser transcription started successfully');
    console.log('Recording started with browser speech recognition');
  };

  const startRecording = async () => {
    try {
      addDebugLog(`🚀 Starting recording with ${selectedTranscriber === 'webspeech' ? 'Web Speech API' : 'Browser Speech Recognition'}...`);
      
      // Clear previous debug logs and test transcripts
      setDebugLog([]);
      setTestTranscripts([]);
      
      if (selectedTranscriber === 'webspeech') {
        await startWebSpeechTranscription();
      } else {
        await startBrowserTranscription();
      }
      
      setIsRecording(true);
      setRealtimeTranscripts([]);
      setSpeakerCount(1);
      setStartTime(new Date().toISOString());
      setConnectionStatus("Connected");
      
      addDebugLog('✅ Recording started successfully');
      
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

      toast.success(`Recording started with ${selectedTranscriber === 'webspeech' ? 'Web Speech API' : 'Browser Speech Recognition'}!`);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      addDebugLog(`❌ Failed to start: ${error.message}`);
      toast.error(error.message || 'Failed to start recording');
      setIsRecording(false);
      setConnectionStatus("Error");
    }
  };

  const stopRecording = async () => {
    addDebugLog('🛑 Stopping recording...');
    console.log('Stopping recording...');
    
    // Stop duration timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Stop microphone stream
    if (micAudioStreamRef.current) {
      micAudioStreamRef.current.getTracks().forEach(track => track.stop());
      micAudioStreamRef.current = null;
    }
    
    // Stop appropriate transcriber
    if (deepgramTranscriberRef.current) {
      deepgramTranscriberRef.current.stopTranscription();
      deepgramTranscriberRef.current = null;
    }
    
    if (webSpeechTranscriberRef.current) {
      webSpeechTranscriberRef.current.stopTranscription();
      webSpeechTranscriberRef.current = null;
    }
    
    setIsRecording(false);
    setConnectionStatus("Disconnected");
    
    // Clear unsaved meeting data when stopping normally
    localStorage.removeItem('unsaved_meeting_v2');
    
    console.log('Recording stopped');
    toast.success('Recording stopped');
    
    // Check if recording has sufficient content
    if (duration < 5 || !transcript || transcript.trim().length < 10) {
      return;
    }
    
    // Prepare meeting data
    const meetingData = {
      title: meetingSettings.title || 'General Meeting V2',
      duration: formatDuration(duration),
      wordCount: wordCount,
      transcript: transcript,
      speakerCount: speakerCount,
      startTime: startTime
    };

    // Navigate to summary
    navigate('/meeting-summary', { state: meetingData });
  };

  // Load meeting history on component mount
  useEffect(() => {
    const fetchMeetings = async () => {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setMeetings(data || []);
        setFilteredMeetings(data || []);
      } catch (error: any) {
        console.error("Error fetching meetings:", error);
        toast.error(error.message || "Failed to load meeting history");
      } finally {
        setLoadingHistory(false);
      }
    };

    if (user) {
      fetchMeetings();
    }
  }, [user]);

  // Search functionality
  useEffect(() => {
    const filterMeetings = () => {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = meetings.filter(meeting => {
        return (
          meeting.title.toLowerCase().includes(lowerCaseQuery) ||
          meeting.description.toLowerCase().includes(lowerCaseQuery) ||
          meeting.transcript.toLowerCase().includes(lowerCaseQuery)
        );
      });
      setFilteredMeetings(filtered);
    };

    filterMeetings();
  }, [searchQuery, meetings]);

  // Multi-select mode functions
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedMeetings([]); // Clear selected meetings when toggling select mode
  };

  const toggleMeetingSelection = (meetingId: string) => {
    setSelectedMeetings(prevSelected => {
      if (prevSelected.includes(meetingId)) {
        return prevSelected.filter(id => id !== meetingId);
      } else {
        return [...prevSelected, meetingId];
      }
    });
  };

  const handleDeleteConfirmation = () => {
    if (selectedMeetings.length === 0) {
      toast.error("No meetings selected for deletion.");
      return;
    }

    setDeleteConfirmation(
      `Are you sure you want to delete ${selectedMeetings.length} meeting(s)? This action cannot be undone.`
    );
  };

  const confirmDeleteMeetings = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', selectedMeetings)
        .eq('user_id', user?.id);

      if (error) {
        throw error;
      }

      // Update local state after successful deletion
      setMeetings(prevMeetings =>
        prevMeetings.filter(meeting => !selectedMeetings.includes(meeting.id))
      );
      setFilteredMeetings(prevFilteredMeetings =>
        prevFilteredMeetings.filter(meeting => !selectedMeetings.includes(meeting.id))
      );

      setSelectedMeetings([]);
      setIsSelectMode(false);
      setDeleteConfirmation("");
      toast.success("Meetings deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting meetings:", error);
      toast.error(error.message || "Failed to delete meetings");
    }
  };

  const cancelDeleteMeetings = () => {
    setDeleteConfirmation("");
  };

  return (
    <div className="flex flex-col space-y-6 p-6 max-w-7xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Meeting Recorder V2</h1>
        <p className="text-muted-foreground">Enhanced with multiple transcription services</p>
      </div>

      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recorder">Record</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="test">Test</TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recording Controls */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Recording Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Transcriber Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Transcription Service:</label>
                  <div className="flex gap-3">
                    <Button
                      variant={selectedTranscriber === 'browser' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTranscriber('browser')}
                      disabled={isRecording}
                      className="flex items-center gap-2"
                    >
                      <Mic className="h-4 w-4" />
                      Browser Speech
                    </Button>
                    <Button
                      variant={selectedTranscriber === 'webspeech' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTranscriber('webspeech')}
                      disabled={isRecording}
                      className="flex items-center gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      Web Speech API
                    </Button>
                  </div>
                </div>

                {/* Recording Button */}
                <div className="flex justify-center">
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    size="lg"
                    className={`h-16 w-16 rounded-full ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {isRecording ? (
                      <Square className="h-8 w-8 text-white" />
                    ) : (
                      <Mic className="h-8 w-8 text-white" />
                    )}
                  </Button>
                </div>

                {/* Status Indicators */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Duration: {formatDuration(duration)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Speakers: {speakerCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {connectionStatus === "Connected" ? (
                      <Wifi className="h-4 w-4 text-green-500" />
                    ) : connectionStatus === "Error" ? (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="text-sm">{connectionStatus}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">Words: {wordCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Transcript */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Waves className="h-5 w-5" />
                  Live Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {realtimeTranscripts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Start recording to see live transcription...
                    </p>
                  ) : (
                    realtimeTranscripts
                      .filter(t => t.isFinal)
                      .slice(-10)
                      .map((t, index) => (
                        <div key={index} className="p-2 bg-muted rounded text-sm">
                          <strong>{t.speaker}:</strong> {t.text}
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {Math.round(t.confidence * 100)}%
                          </Badge>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Debug Log */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-32 overflow-y-auto">
                {debugLog.length === 0 ? (
                  <div className="text-gray-500">Debug information will appear here...</div>
                ) : (
                  debugLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="text-center p-8">
            <p className="text-muted-foreground">Meeting history will be implemented here</p>
          </div>
        </TabsContent>

        <TabsContent value="test">
          <div className="text-center p-8">
            <p className="text-muted-foreground">Transcription test will be implemented here</p>
          </div>
        </TabsContent>
      </Tabs>

      {isGeneratingNotes && <NotewellAIAnimation isVisible={true} />}
    </div>
  );
};
