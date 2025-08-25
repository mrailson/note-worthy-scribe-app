import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, addMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History, Search, Trash2, CheckSquare, SquareIcon, Monitor, Volume2, Waves, Video, Headphones, AlertCircle, Eye, EyeOff, RotateCcw, MonitorSpeaker, RefreshCw, Sparkles, Pause, Calendar, Edit, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { FullPageNotesModal } from "@/components/FullPageNotesModal";
import { MicInputRecordingTester } from "@/components/MicInputRecordingTester";
import { SharedMeetingsManager } from "@/components/SharedMeetingsManager";
import { LiveTranscript } from "@/components/LiveTranscript";
import { DashboardLauncher } from "@/components/meeting-dashboard/DashboardLauncher";
import { RealtimeMeetingDashboard } from "@/components/meeting-dashboard/RealtimeMeetingDashboard";

import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { IncrementalTranscriptHandler, IncrementalTranscriptData } from '@/utils/IncrementalTranscriptHandler';
import { StereoAudioCapture } from '@/utils/StereoAudioCapture';
import { transcriptCleaner, RemovedSegment } from '@/utils/TranscriptCleaner';
import { DeepgramTranscriber } from '@/utils/DeepgramTranscriber';
import { useMeetingData } from "@/hooks/useMeetingData";

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
    practiceId?: string;
  };
  initialActiveTab?: string;
}

export const MeetingRecorder = ({ 
  onTranscriptUpdate, 
  onDurationUpdate, 
  onWordCountUpdate,
  initialSettings,
  initialActiveTab
}: MeetingRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStoppingRecording, setIsStoppingRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);
  const [chunkCounter, setChunkCounter] = useState(0);
  const [removedSegments, setRemovedSegments] = useState<RemovedSegment[]>([]);
  
  // Update removed segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRemovedSegments(transcriptCleaner.getRemovedSegments());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [wordCount, setWordCount] = useState(0);
  const [confidence, setConfidence] = useState<number | undefined>(undefined);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [lastPhrase, setLastPhrase] = useState("");
  const [startTime, setStartTime] = useState("");
  const [liveSummary, setLiveSummary] = useState("");
  const [tickerText, setTickerText] = useState("");
  const [showTicker, setShowTicker] = useState(false);
  const [transcriptSnippet, setTranscriptSnippet] = useState("");
  const [showTranscriptSnippet, setShowTranscriptSnippet] = useState(false);
  const [isSystemPermissionGranted, setIsSystemPermissionGranted] = useState(false);
  const [transcriptSource, setTranscriptSource] = useState<string>("Microphone");
  const [showComputerAudioOption, setShowComputerAudioOption] = useState(false);
  const [meetingSessionId, setMeetingSessionId] = useState<string>("");
  const [speakerLabels, setSpeakerLabels] = useState<string[]>([]);
  const [micTestServiceVisible, setMicTestServiceVisible] = useState(false);
  
  // Recording mode state
  const [recordingMode, setRecordingMode] = useState<'mic-only' | 'mic-and-system'>('mic-only');
  
  // Pause/Mute state
  const [isPaused, setIsPaused] = useState(false);
  
  
  // Meeting history state
  const [meetings, setMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Search and multi-select state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  // Meeting editing state
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  
  // Modal states for viewing notes and transcripts
  const [fullPageModalOpen, setFullPageModalOpen] = useState(false);
  const [modalMeeting, setModalMeeting] = useState<any>(null);
  const [modalNotes, setModalNotes] = useState("");
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [currentMeetingForTranscript, setCurrentMeetingForTranscript] = useState<any>(null);
  
  // Dashboard state
  const [dashboardOpen, setDashboardOpen] = useState(false);
  // Combined modal state for end-of-meeting process
  const [meetingEndModal, setMeetingEndModal] = useState<{
    isOpen: boolean;
    stage: 'processing' | 'saving' | 'success';
    savedData?: any;
  }>({
    isOpen: false,
    stage: 'processing',
    savedData: null
  });
  const [processingDots, setProcessingDots] = useState('');
  
  const [processingStage, setProcessingStage] = useState({
    transcribing: false,
    cleaning: false,
    summarizing: false,
    saving: false,
    securing: false,
    complete: false
  });
  
  
  // Meeting settings - use from useMeetingData hook
  const {
    meetingSettings,
    setMeetingSettings: updateMeetingSettings
  } = useMeetingData();

  // Timestamp toggle state
  const [showTimestamps, setShowTimestamps] = useState(true);

  const handleTimestampsToggle = (show: boolean) => {
    setShowTimestamps(show);
  };

  // Function to clear all data and reset the recording interface
  const handleNewMeeting = async () => {
    // Reset all recording states
    if (isRecording) {
      await stopRecording();
    }
    
    setIsRecording(false);
    setIsStoppingRecording(false);
    setDuration(0);
    setTranscript("");
    setRealtimeTranscripts([]);
    setChunkCounter(0);
    setConnectionStatus("Disconnected");
    setWordCount(0);
    setConfidence(undefined);
    setDebugLog([]);
    setIsDebugVisible(false);
    setLastPhrase("");
    setStartTime("");
    setLiveSummary("");
    setTickerText("");
    setShowTicker(false);
    setTranscriptSnippet("");
    setShowTranscriptSnippet(false);
    setSelectedMeetings([]);
    setIsSelectMode(false);
    setDeleteConfirmation("");
    updateMeetingSettings({
      title: "General Meeting",
      description: "",
      meetingType: "general",
      practiceId: "",
      meetingFormat: "teams",
      meetingStyle: "standard", 
      attendees: "",
      agenda: "",
      date: "",
      startTime: "",
      format: "",
      location: ""
    });
    
    // Clear parent component state
    onTranscriptUpdate("");
    onDurationUpdate("00:00");
    onWordCountUpdate(0);
    
    // Stop all transcribers
    if (browserTranscriberRef.current) {
      browserTranscriberRef.current.stopTranscription();
      browserTranscriberRef.current = null;
    }
    
    if (deepgramTranscriberRef.current) {
      deepgramTranscriberRef.current.stopTranscription();
      deepgramTranscriberRef.current = null;
    }

    // Clear any stored session data
    sessionStorage.removeItem('currentSessionId');
    sessionStorage.removeItem('meetingData');
    
    // Reset processing modal
    setMeetingEndModal({
      isOpen: false,
      stage: 'processing',
      savedData: null
    });

    // Reload meeting history to reflect any deletions
    await loadMeetings();
    
    toast.success("New meeting started");
  };

  const { user } = useAuth();
  const navigate = useNavigate();

  // Refs for managing recording state
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const browserTranscriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const deepgramTranscriberRef = useRef<DeepgramTranscriber | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const enhancedAudioCaptureRef = useRef<any>(null);

  // Auto-save meeting data to localStorage
  const autoSaveMeeting = () => {
    if (isRecording && transcript && duration > 5) {
      const meetingData = {
        title: meetingSettings.title || "General Meeting",
        transcript,
        duration: `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`,
        wordCount,
        timestamp: new Date().toISOString(),
        connectionStatus,
        speakerCount: speakerLabels.length || 1
      };
      
      localStorage.setItem('meetingData', JSON.stringify(meetingData));
    }
  };

  // Auto-save every 10 seconds during recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(autoSaveMeeting, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, transcript, duration, wordCount, connectionStatus, meetingSettings.title, speakerLabels]);

  // Timer effect for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      recordingIntervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          const formattedDuration = `${Math.floor(newDuration / 60).toString().padStart(2, '0')}:${(newDuration % 60).toString().padStart(2, '0')}`;
          onDurationUpdate(formattedDuration);
          return newDuration;
        });
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }

    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [isRecording, isPaused, onDurationUpdate]);

  // Stop all transcribers when component unmounts or recording stops
  useEffect(() => {
    return () => {
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
      if (deepgramTranscriberRef.current) {
        deepgramTranscriberRef.current.stopTranscription();
      }
    };
  }, []);

  // Debug logging function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-19), `[${timestamp}] ${message}`]);
  };

  // Session management
  const generateSessionId = () => {
    const sessionId = crypto.randomUUID();
    setMeetingSessionId(sessionId);
    sessionStorage.setItem('currentSessionId', sessionId);
    return sessionId;
  };

  // Handle transcription data from various sources
  const handleBrowserTranscript = (data: BrowserTranscriptData) => {
    if (!data.text || data.text.trim() === "") return;

    const newTranscript: TranscriptData = {
      text: data.text,
      speaker: data.speaker || "Speaker",
      confidence: data.confidence || 0.8,
      timestamp: new Date().toLocaleTimeString(),
      isFinal: data.is_final || false
    };

    // Update real-time transcripts
    if (data.is_final) {
      setRealtimeTranscripts(prev => [...prev, newTranscript]);
    } else {
      setRealtimeTranscripts(prev => {
        const updated = [...prev];
        if (updated.length > 0 && !updated[updated.length - 1].isFinal) {
          updated[updated.length - 1] = newTranscript;
        } else {
          updated.push(newTranscript);
        }
        return updated;
      });
    }

    // Update transcript text
    if (data.is_final) {
      setTranscript(prev => {
        const newText = prev + (prev ? ' ' : '') + data.text;
        onTranscriptUpdate(newText);

        // Update word count
        const words = newText.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
        onWordCountUpdate(words.length);

        return newText;
      });
    }

    // Update confidence and last phrase
    setConfidence(data.confidence);
    if (data.text && data.text.length > 0) {
      setLastPhrase(data.text);
    }
  };

  // Handle transcription errors
  const handleTranscriptionError = (error: string) => {
    console.error('Transcription error:', error);
    addDebugLog(`❌ Transcription error: ${error}`);
    setConnectionStatus("Error");
    toast.error(`Transcription error: ${error}`);
  };

  // Handle status changes
  const handleStatusChange = (status: string) => {
    setConnectionStatus(status);
    addDebugLog(`🔄 Status: ${status}`);
  };

  // Deepgram transcription for enhanced accuracy
  const startDeepgramTranscription = async () => {
    try {
      console.log('🚀 Starting Deepgram transcription...');
      addDebugLog('🚀 Starting Deepgram transcription...');
      
      deepgramTranscriberRef.current = new DeepgramTranscriber(
        handleBrowserTranscript,
        handleTranscriptionError,
        handleStatusChange
      );

      // Ensure a session/meeting id and link it to the Deepgram transcriber
      const existingSession = sessionStorage.getItem('currentSessionId') || generateSessionId();
      deepgramTranscriberRef.current.setMeetingId(existingSession);

      await deepgramTranscriberRef.current.startTranscription();
      console.log('✅ Deepgram transcription started successfully');
      addDebugLog('✅ Deepgram transcription started');
    } catch (error) {
      console.error('❌ Deepgram transcription error:', error);
      addDebugLog(`❌ Failed to start Deepgram: ${error}`);
      throw error;
    }
  };

  // Browser Speech Recognition as fallback
  const startBrowserSpeechRecognition = async () => {
    console.log('🎤 Starting browser speech recognition...');
    addDebugLog('🎤 Starting browser speech recognition...');
    
    browserTranscriberRef.current = new BrowserSpeechTranscriber(
      handleBrowserTranscript,
      handleTranscriptionError,
      handleStatusChange
    );

    await browserTranscriberRef.current.startTranscription();
    addDebugLog('✅ Microphone speech recognition started successfully');
    console.log('Recording started with microphone speech recognition');
  };

  // Smart transcription method that uses Deepgram as primary with browser fallback
  const startMicrophoneTranscription = async () => {
    console.log('🎙️ Starting transcription service...');
    addDebugLog('🎙️ Starting transcription service...');
    
    try {
      await startDeepgramTranscription();
    } catch (error) {
      // Fall back to browser speech recognition
      console.log('🔄 Falling back to browser speech recognition...');
      addDebugLog('🔄 Falling back to browser speech recognition...');
      await startBrowserSpeechRecognition();
    }
  };

  // Computer audio transcription for Teams/Zoom meetings using enhanced audio processing
  const startComputerAudioTranscription = async () => {
    try {
      // Enhanced system audio capture with improved filtering
      const EnhancedAudioCapture = await import('@/utils/EnhancedAudioCapture');
      const audioCapture = new EnhancedAudioCapture.default();
      
      enhancedAudioCaptureRef.current = audioCapture;
      
      console.log('💻 Starting enhanced computer audio transcription...');
      addDebugLog('💻 Starting enhanced computer audio transcription...');
      
      // Request system audio permission
      try {
        await audioCapture.requestSystemAudioPermission();
        setIsSystemPermissionGranted(true);
        console.log('✅ System audio permission granted');
        addDebugLog('✅ System audio permission granted');
      } catch (permError) {
        console.warn('⚠️ System audio permission denied, using microphone instead');
        addDebugLog('⚠️ System audio permission denied, using microphone instead');
        await startMicrophoneTranscription();
        return;
      }

      // Start computer audio capture with Deepgram processing
      deepgramTranscriberRef.current = new DeepgramTranscriber(
        handleBrowserTranscript,
        handleTranscriptionError,
        handleStatusChange
      );

      // Ensure session ID
      const sessionId = sessionStorage.getItem('currentSessionId') || generateSessionId();
      deepgramTranscriberRef.current.setMeetingId(sessionId);

      // Connect enhanced audio capture to Deepgram
      await audioCapture.startCapture(async (audioBlob: Blob) => {
        if (deepgramTranscriberRef.current && audioBlob.size > 0) {
          try {
            await deepgramTranscriberRef.current.processAudioBlob(audioBlob);
          } catch (error) {
            console.error('Error processing audio blob:', error);
          }
        }
      });

      console.log('✅ Enhanced computer audio transcription started');
      addDebugLog('✅ Enhanced computer audio transcription started');
      setTranscriptSource("Computer Audio (Enhanced)");
      
    } catch (error) {
      console.error('❌ Computer audio transcription failed:', error);
      addDebugLog(`❌ Computer audio failed: ${error}`);
      // Fallback to microphone
      await startMicrophoneTranscription();
      setTranscriptSource("Microphone (Fallback)");
    }
  };

  // Main recording start function
  const startRecording = async () => {
    if (isRecording) return;

    try {
      setIsRecording(true);
      setStartTime(new Date().toLocaleTimeString());
      const sessionId = generateSessionId();
      
      addDebugLog('🎬 Starting recording session...');
      console.log('🎬 Starting new recording session:', sessionId);

      // Choose recording mode based on user preference
      if (recordingMode === 'mic-and-system') {
        await startComputerAudioTranscription();
      } else {
        await startMicrophoneTranscription();
        setTranscriptSource("Microphone");
      }

      toast.success("Recording started!");
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      addDebugLog(`❌ Failed to start recording: ${error}`);
      setIsRecording(false);
      toast.error("Failed to start recording");
    }
  };

  // Stop recording and clean up
  const stopRecording = async () => {
    if (!isRecording || isStoppingRecording) return;

    setIsStoppingRecording(true);
    addDebugLog('🛑 Stopping recording...');

    // Stop browser speech recognition
    if (browserTranscriberRef.current) {
      browserTranscriberRef.current.stopTranscription();
      browserTranscriberRef.current = null;
    }

    // Stop Deepgram transcription
    if (deepgramTranscriberRef.current) {
      deepgramTranscriberRef.current.stopTranscription();
      deepgramTranscriberRef.current = null;
    }

    // Stop enhanced audio capture
    if (enhancedAudioCaptureRef.current) {
      try {
        await enhancedAudioCaptureRef.current.stopCapture();
        enhancedAudioCaptureRef.current = null;
      } catch (error) {
        console.error('Error stopping enhanced audio capture:', error);
      }
    }

    setIsRecording(false);
    setIsStoppingRecording(false);
    setConnectionStatus("Disconnected");
    
    addDebugLog('✅ Recording stopped');
    toast.success("Recording stopped");
  };

  // Load meetings from database
  const loadMeetings = async () => {
    if (!user) return;

    setLoadingHistory(true);
    try {
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMeetings(meetings || []);
      setFilteredMeetings(meetings || []);
    } catch (error) {
      console.error('Error loading meetings:', error);
      toast.error('Failed to load meeting history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load meetings on component mount
  useEffect(() => {
    loadMeetings();
  }, [user]);

  // Filter meetings based on search query
  useEffect(() => {
    if (!searchQuery) {
      setFilteredMeetings(meetings);
    } else {
      const filtered = meetings.filter(meeting =>
        meeting.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.transcript?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMeetings(filtered);
    }
  }, [searchQuery, meetings]);

  // Delete selected meetings
  const deleteSelectedMeetings = async () => {
    if (selectedMeetings.length === 0) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .in('id', selectedMeetings);

      if (error) throw error;

      toast.success(`${selectedMeetings.length} meeting(s) deleted`);
      setSelectedMeetings([]);
      setIsSelectMode(false);
      await loadMeetings();
    } catch (error) {
      console.error('Error deleting meetings:', error);
      toast.error('Failed to delete meetings');
    }
  };

  // Save current meeting
  const saveCurrentMeeting = async () => {
    if (!transcript || !user) return;

    try {
      const durationMinutes = Math.floor(duration / 60) + (duration % 60) / 60;
      
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          user_id: user.id,
          title: meetingSettings.title || `Meeting ${new Date().toLocaleDateString()}`,
          transcript,
          duration_minutes: durationMinutes,
          word_count: wordCount,
          speaker_count: speakerLabels.length || 1,
          start_time: startTime,
          practice_id: meetingSettings.practiceId || null,
          meeting_format: meetingSettings.meetingFormat || 'teams'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Meeting saved successfully');
      await loadMeetings();
      
      return data;
    } catch (error) {
      console.error('Error saving meeting:', error);
      toast.error('Failed to save meeting');
    }
  };

  // Navigate to meeting summary
  const handleViewSummary = async () => {
    const meetingData = {
      title: meetingSettings.title || "General Meeting",
      duration: `${Math.floor(duration / 60).toString().padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`,
      wordCount,
      transcript,
      speakerCount: speakerLabels.length || 1,
      startTime: new Date().toISOString()
    };

    navigate('/meeting-summary', {
      state: meetingData
    });
  };

  // Pause/Resume recording
  const pauseRecording = async () => {
    if (!isRecording || isPaused) return;
    
    try {
      setIsPaused(true);
      
      // Pause all active transcribers
      if (browserTranscriberRef.current) {
        // Browser speech recognition doesn't have native pause, so we stop and will restart
        browserTranscriberRef.current.stopTranscription();
      }
      
      if (deepgramTranscriberRef.current) {
        deepgramTranscriberRef.current.pauseTranscription?.();
      }
      
      addDebugLog('⏸️ Recording paused');
      toast.success("Recording paused");
    } catch (error) {
      console.error('Error pausing recording:', error);
      toast.error("Failed to pause recording");
    }
  };

  const resumeRecording = async () => {
    if (!isRecording || !isPaused) return;
    
    try {
      setIsPaused(false);
      
      // Resume all active transcribers
      if (deepgramTranscriberRef.current) {
        deepgramTranscriberRef.current.resumeTranscription?.();
      } else {
        // Restart browser speech recognition if it was the active transcriber
        await startBrowserSpeechRecognition();
      }
      
      addDebugLog('▶️ Recording resumed');
      toast.success("Recording resumed");
    } catch (error) {
      console.error('Error resuming recording:', error);
      toast.error("Failed to resume recording");
    }
  };

  // Settings handlers
  const handleSettingsChange = (newSettings: any) => {
    updateMeetingSettings(newSettings);
  };
              
  return (
    <div className="space-y-6">
      {/* Tabbed Interface */}
      <Tabs defaultValue={initialActiveTab || "recorder"} className="w-full">
        <TabsList className={`grid w-full ${micTestServiceVisible ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="recorder" className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Recorder
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-5 w-5" />
            History
          </TabsTrigger>
          {micTestServiceVisible && (
            <TabsTrigger value="mic-test" className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Mic Test
            </TabsTrigger>
          )}
        </TabsList>

        {/* Recorder Tab */}
        <TabsContent value="recorder" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Recording Controls */}
            <div className="lg:col-span-1 space-y-4">
            {/* Compact Recording Controls */}
            <Card className="shadow-lg">
              <CardContent className="pt-4 pb-4">
                <div className="text-center space-y-4">
                   {!isRecording ? (
                      <div className="space-y-4">
                        {/* Recording Service Indicator */}
                        <div className="flex justify-center">
                          <Badge variant="outline" className="text-xs font-mono">
                            Service: DEEPGRAM
                          </Badge>
                        </div>
                       
                       <Button 
                         onClick={startRecording}
                         size="lg"
                         className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                       >
                         <Mic className="h-5 w-5 mr-2" />
                         Start Recording
                       </Button>
                       
                       {/* Recording Mode Selection */}
                       <div className="space-y-2">
                         <Label className="text-sm font-medium">Recording Mode</Label>
                         <Select value={recordingMode} onValueChange={(value: 'mic-only' | 'mic-and-system') => setRecordingMode(value)}>
                           <SelectTrigger className="w-full">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="mic-only">
                               <div className="flex items-center gap-2">
                                 <Mic className="h-4 w-4" />
                                 Microphone Only
                               </div>
                             </SelectItem>
                             <SelectItem value="mic-and-system">
                               <div className="flex items-center gap-2">
                                 <MonitorSpeaker className="h-4 w-4" />
                                 Microphone + Computer Audio
                               </div>
                             </SelectItem>
                           </SelectContent>
                         </Select>
                       </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Active Recording Indicator */}
                        <div className="flex justify-center">
                          <Badge variant="secondary" className="text-xs font-mono animate-pulse">
                            DEEPGRAM Active
                          </Badge>
                        </div>
                        
                        {/* Pause/Resume Controls */}
                        {!isPaused ? (
                          <Button 
                            onClick={pauseRecording}
                            size="lg"
                            variant="outline"
                            className="px-8 py-4 text-base font-semibold rounded-lg border-2"
                          >
                            <Pause className="h-5 w-5 mr-2" />
                            Pause
                          </Button>
                        ) : (
                          <Button 
                            onClick={resumeRecording}
                            size="lg"
                            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-8 py-4 text-base font-semibold rounded-lg"
                          >
                            <Play className="h-5 w-5 mr-2" />
                            Resume
                          </Button>
                        )}
                        
                        <Button 
                          onClick={stopRecording}
                          size="lg"
                          variant="destructive"
                          disabled={isStoppingRecording}
                          className="px-8 py-4 text-base font-semibold rounded-lg"
                        >
                          <Square className="h-5 w-5 mr-2" />
                          {isStoppingRecording ? "Stopping..." : "Stop Recording"}
                        </Button>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>

              {/* Recording Stats */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Duration
                      </div>
                      <span className="font-mono text-lg">
                        {Math.floor(duration / 60).toString().padStart(2, '0')}:
                        {(duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        Words
                      </div>
                      <span className="font-mono text-lg">{wordCount}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Speakers
                      </div>
                      <span className="font-mono text-lg">{speakerLabels.length || 1}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {connectionStatus === "Connected" ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-red-500" />
                        )}
                        Status
                      </div>
                      <span className={`text-sm ${connectionStatus === "Connected" ? "text-green-500" : "text-red-500"}`}>
                        {connectionStatus}
                      </span>
                    </div>

                    {confidence !== undefined && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Waves className="h-4 w-4" />
                          Confidence
                        </div>
                        <span className="text-sm">
                          {Math.round(confidence * 100)}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <Button 
                      onClick={handleViewSummary}
                      disabled={!transcript}
                      className="w-full"
                      variant="outline"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Summary
                    </Button>
                    
                    <Button 
                      onClick={saveCurrentMeeting}
                      disabled={!transcript || !user}
                      className="w-full"
                      variant="outline"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Meeting
                    </Button>

                    <Button 
                      onClick={handleNewMeeting}
                      className="w-full"
                      variant="outline"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      New Meeting
                    </Button>

                    {/* Dashboard Launcher */}
                    <DashboardLauncher
                      isRecording={isRecording}
                      meetingData={{
                        transcript,
                        duration,
                        wordCount,
                        connectionStatus
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Debug Panel (Collapsible) */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="text-sm font-medium">Debug Info</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDebugVisible(!isDebugVisible)}
                    >
                      {isDebugVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {isDebugVisible && (
                    <div className="space-y-2">
                      <div className="bg-secondary/30 rounded-md p-3 max-h-48 overflow-y-auto">
                        {debugLog.length > 0 ? (
                          debugLog.map((log, index) => (
                            <div key={index} className="text-xs font-mono text-muted-foreground">
                              {log}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            No debug information yet
                          </div>
                        )}
                      </div>
                      
                      {lastPhrase && (
                        <div className="mt-2">
                          <Label className="text-xs text-muted-foreground">Last Phrase:</Label>
                          <div className="text-xs bg-secondary/20 rounded p-2 mt-1">
                            {lastPhrase}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Columns - Live Transcript */}
            <div className="lg:col-span-2">
              <Card className="border-accent/30">
                  <CardContent className="space-y-4">
                  {/* Live Transcript with Enhanced Two-Section Layout */}
                  <LiveTranscript
                    transcript={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.text || "" : ""}
                    confidence={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.confidence : undefined}
                    showTimestamps={showTimestamps}
                    onTimestampsToggle={handleTimestampsToggle}
                    attendees={""}
                    meetingSettings={{
                      practiceId: (meetingSettings as any)?.practiceId || "",
                      meetingFormat: (meetingSettings as any)?.meetingFormat || "teams"
                    }}
                    onMeetingSettingsChange={(settings) => {
                      updateMeetingSettings(prev => ({
                        ...prev,
                        practiceId: settings.practiceId,
                        meetingFormat: settings.meetingFormat
                      }));
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <MeetingSettings
            initialSettings={meetingSettings}
            onSettingsChange={handleSettingsChange}
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <MeetingHistoryList 
            meetings={filteredMeetings}
            loading={loadingHistory}
            onRefresh={loadMeetings}
          />
        </TabsContent>

        {/* Mic Test Tab */}
        {micTestServiceVisible && (
          <TabsContent value="mic-test" className="space-y-6">
            <MicInputRecordingTester />
          </TabsContent>
        )}
      </Tabs>

      {/* Full Page Notes Modal */}
      <FullPageNotesModal
        isOpen={fullPageModalOpen}
        onClose={() => setFullPageModalOpen(false)}
        meeting={modalMeeting}
        notes={modalNotes}
        onNotesChange={setModalNotes}
      />

      {/* Meeting End Processing Modal */}
      <AlertDialog open={meetingEndModal.isOpen} onOpenChange={(open) => !open && setMeetingEndModal(prev => ({ ...prev, isOpen: false }))}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {meetingEndModal.stage === 'processing' && <NotewellAIAnimation isVisible={true} />}
              {meetingEndModal.stage === 'saving' && <Save className="h-5 w-5 animate-pulse" />}
              {meetingEndModal.stage === 'success' && <Sparkles className="h-5 w-5 text-green-500" />}
              
              {meetingEndModal.stage === 'processing' && "Processing Meeting"}
              {meetingEndModal.stage === 'saving' && "Saving Meeting"}
              {meetingEndModal.stage === 'success' && "Meeting Saved"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {meetingEndModal.stage === 'processing' && (
                <div className="space-y-2">
                  <p>AI is processing your meeting transcript{processingDots}</p>
                  <div className="space-y-1 text-xs">
                    <div className={`flex items-center gap-2 ${processingStage.transcribing ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${processingStage.transcribing ? 'bg-blue-600 animate-pulse' : 'bg-muted-foreground'}`} />
                      Transcribing audio
                    </div>
                    <div className={`flex items-center gap-2 ${processingStage.cleaning ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${processingStage.cleaning ? 'bg-blue-600 animate-pulse' : 'bg-muted-foreground'}`} />
                      Cleaning transcript
                    </div>
                    <div className={`flex items-center gap-2 ${processingStage.summarizing ? 'text-blue-600' : 'text-muted-foreground'}`}>
                      <div className={`w-2 h-2 rounded-full ${processingStage.summarizing ? 'bg-blue-600 animate-pulse' : 'bg-muted-foreground'}`} />
                      Generating summary
                    </div>
                  </div>
                </div>
              )}
              {meetingEndModal.stage === 'saving' && "Securely saving your meeting data..."}
              {meetingEndModal.stage === 'success' && "Your meeting has been successfully saved and is ready for review."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {meetingEndModal.stage === 'success' && (
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                setMeetingEndModal({ isOpen: false, stage: 'processing', savedData: null });
                handleNewMeeting();
              }}>
                Start New Meeting
              </AlertDialogAction>
              <AlertDialogAction onClick={() => {
                if (meetingEndModal.savedData) {
                  handleViewSummary();
                }
                setMeetingEndModal({ isOpen: false, stage: 'processing', savedData: null });
              }}>
                View Summary
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};