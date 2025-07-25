import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MeetingSettings } from '@/components/MeetingSettings';
import { MeetingHistoryList } from '@/components/MeetingHistoryList';
import { MeetingSearchBar, SearchFilters } from '@/components/MeetingSearchBar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Mic, 
  MicOff, 
  Headphones, 
  Wifi, 
  WifiOff, 
  Clock, 
  Users, 
  MessageCircle, 
  Waves,
  Play,
  Square,
  Settings,
  Trash2,
  Search,
  Download,
  FileText,
  Calendar,
  Filter,
  Eye,
  Edit,
  MoreVertical,
  CheckSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { ImportedTranscript } from '@/utils/FileImporter';

interface TranscriptData {
  text: string;
  speaker: string;
  confidence: number;
  timestamp: string;
  isFinal: boolean;
}

interface MeetingRecorderProps {
  onTranscriptUpdate: (transcript: TranscriptData[]) => void;
  onDurationUpdate: (duration: string) => void;
  onWordCountUpdate: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

const MeetingRecorder: React.FC<MeetingRecorderProps> = ({
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [duration, setDuration] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [speakerCount, setSpeakerCount] = useState(1);
  const [transcript, setTranscript] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [recordingMode, setRecordingMode] = useState<'microphone' | 'computer-audio'>('computer-audio');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Test recording states
  const [testTranscripts, setTestTranscripts] = useState<string[]>([]);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [realtimeTranscripts, setRealtimeTranscripts] = useState<TranscriptData[]>([]);

  // Meeting history states
  const [meetings, setMeetings] = useState<any[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState<Partial<SearchFilters>>({});

  // Refs
  const intervalRef = useRef<NodeJS.Timeout>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micAudioStreamRef = useRef<MediaStream | null>(null);
  const browserTranscriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Transcript handling
  const handleTranscript = (data: TranscriptData) => {
    setRealtimeTranscripts(prev => {
      const newTranscripts = [...prev, data];
      onTranscriptUpdate(newTranscripts);
      
      // Update transcript string and word count
      if (data.isFinal) {
        const fullTranscript = newTranscripts
          .filter(t => t.isFinal)
          .map(t => `${t.speaker}: ${t.text}`)
          .join('\n');
        
        setTranscript(fullTranscript);
        
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
        onWordCountUpdate(words.length);
      }
      
      return newTranscripts;
    });
  };

  const handleBrowserTranscript = (data: BrowserTranscriptData) => {
    const transcriptData: TranscriptData = {
      text: data.text,
      speaker: data.speaker || 'Speaker 1',
      confidence: data.confidence,
      timestamp: new Date().toISOString(),
      isFinal: data.is_final
    };
    
    addDebugLog(`🎙️ ${data.is_final ? 'Final' : 'Interim'}: "${data.text}" (${Math.round(data.confidence * 100)}%)`);
    console.log('🔥 ADDING TO TEST TRANSCRIPTS:', data.text);
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
    setDebugLog(prev => [...prev.slice(-19), logEntry]);
    console.log(logEntry);
  };

  const handleStatusChange = (status: string) => {
    setConnectionStatus(status);
    addDebugLog(`🔄 Status: ${status}`);
  };

  const handleLiveSummary = (summary: string) => {
    addDebugLog(`📄 Summary generated (${summary.length} chars)`);
  };

  // Array buffer to base64 conversion
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Microphone-only transcription
  const startMicrophoneTranscription = async () => {
    addDebugLog('🎤 Starting microphone speech recognition...');
    
    const transcriber = new BrowserSpeechTranscriber(
      handleBrowserTranscript,
      handleTranscriptionError,
      handleStatusChange,
      handleLiveSummary
    );

    await transcriber.startTranscription();
    browserTranscriberRef.current = transcriber;
    
    addDebugLog('✅ Microphone speech recognition started successfully');
  };

  // Separate dual audio capture
  const startTestMode = async () => {
    addDebugLog('🎤 Starting separate dual audio capture (system + microphone)...');
    
    try {
      // Step 1: Get system audio
      addDebugLog('📺 Requesting screen capture with audio...');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: true
      });
      
      // Step 2: Get microphone audio separately  
      addDebugLog('🎤 Requesting microphone access...');
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      
      addDebugLog('✅ Both audio streams captured successfully');
      
      // Step 3: Set up separate recorders
      const systemChunks: Blob[] = [];
      const micChunks: Blob[] = [];
      
      const systemRecorder = new MediaRecorder(displayStream);
      const micRecorder = new MediaRecorder(micStream);
      
      systemRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          systemChunks.push(e.data);
          addDebugLog(`📺 System: ${(e.data.size/1024).toFixed(1)}KB`);
        }
      };
      
      micRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          micChunks.push(e.data);
          addDebugLog(`🎤 Mic: ${(e.data.size/1024).toFixed(1)}KB`);
        }
      };
      
      // Process audio separately
      const processSystemAudio = async () => {
        if (systemChunks.length > 0) {
          const blob = new Blob(systemChunks, { type: 'audio/webm' });
          systemChunks.length = 0;
          await processAudioBlob(blob, 'System Audio');
        }
      };
      
      const processMicAudio = async () => {
        if (micChunks.length > 0) {
          const blob = new Blob(micChunks, { type: 'audio/webm' });
          micChunks.length = 0;
          await processAudioBlob(blob, 'Microphone');
        }
      };
      
      // Start both recorders
      systemRecorder.start(5000);
      micRecorder.start(5000);
      
      const systemInterval = setInterval(processSystemAudio, 5000);
      const micInterval = setInterval(processMicAudio, 5000);
      
      // Store cleanup
      mediaRecorderRef.current = {
        ...systemRecorder,
        cleanup: () => {
          clearInterval(systemInterval);
          clearInterval(micInterval);
          systemRecorder.stop();
          micRecorder.stop();
          displayStream.getTracks().forEach(t => t.stop());
          micStream.getTracks().forEach(t => t.stop());
        }
      } as any;
      
      addDebugLog('🎯 Dual audio recording started');
      
    } catch (error) {
      console.error('Dual audio error:', error);
      throw error;
    }
  };

  // Process individual audio blobs
  const processAudioBlob = async (audioBlob: Blob, source: string) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);
      
      const { data, error } = await supabase.functions.invoke('process-meeting-audio', {
        body: { audio: base64Audio }
      });

      if (error) throw new Error(error.message);

      if (data?.success && data?.transcript) {
        addDebugLog(`✅ ${source}: "${data.transcript}"`);
        
        setTimeout(() => {
          handleBrowserTranscript({
            text: data.transcript,
            is_final: true,
            confidence: 0.95,
            speaker: source
          });
        }, 0);
      }
    } catch (error) {
      addDebugLog(`❌ ${source} failed: ${error.message}`);
    }
  };

  const startTestRecording = async () => {
    console.log('🔥 START TEST RECORDING CALLED');
    
    try {
      const modeText = recordingMode === 'computer-audio' ? 'dual audio (system + microphone)' : 'microphone';
      console.log('🔥 MODE:', modeText);
      addDebugLog(`🚀 Starting test recording with ${modeText}...`);
      
      setDebugLog([]);
      setTestTranscripts([]);
      
      console.log('🔥 ABOUT TO START MODE');
      
      if (recordingMode === 'computer-audio') {
        await startTestMode();
      } else {
        await startMicrophoneTranscription();
      }
      
      setIsRecording(true);
      setRealtimeTranscripts([]);
      setSpeakerCount(1);
      setStartTime(new Date().toISOString());
      setConnectionStatus("Connected");
      
      addDebugLog('✅ Test recording started successfully');
      
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

      const successMessage = recordingMode === 'computer-audio' ? 
        'Test recording started with dual audio capture!' : 
        'Test recording started with microphone!';
      toast.success(successMessage);
    } catch (error: any) {
      console.error('Failed to start test recording:', error);
      addDebugLog(`❌ Failed to start test: ${error.message}`);
      toast.error(error.message || 'Failed to start test recording');
      setIsRecording(false);
      setConnectionStatus("Error");
    }
  };

  const stopTestRecording = async () => {
    try {
      addDebugLog('🛑 Stopping test recording...');
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        
        if ((mediaRecorderRef.current as any).cleanup) {
          (mediaRecorderRef.current as any).cleanup();
        }
      }
      
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach(track => track.stop());
        micAudioStreamRef.current = null;
      }
      
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      setIsRecording(false);
      setConnectionStatus("Disconnected");
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      addDebugLog('✅ Test recording stopped');
      toast.success('Test recording stopped');
      
    } catch (error: any) {
      console.error('Error stopping test recording:', error);
      addDebugLog(`❌ Error stopping: ${error.message}`);
    }
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        return 'text-green-500';
      case 'Connecting...':
        return 'text-yellow-500';
      case 'Error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  // Handle audio/transcript imports from MeetingSettings
  const handleAudioImported = (audioFile: File) => {
    addDebugLog(`📁 Audio file imported: ${audioFile.name}`);
    toast.success(`Audio file imported: ${audioFile.name}`);
  };

  const handleTranscriptImported = (importedTranscript: ImportedTranscript) => {
    addDebugLog(`📄 Transcript imported: ${importedTranscript.wordCount} words`);
    setTranscript(importedTranscript.content);
    setWordCount(importedTranscript.wordCount);
    onWordCountUpdate(importedTranscript.wordCount);
    toast.success(`Transcript imported: ${importedTranscript.wordCount} words`);
  };

  // Meeting history handlers
  const handleMeetingEdit = (meetingId: string) => {
    // Navigate to edit the meeting
    window.open(`/?edit=${meetingId}`, '_blank');
  };

  const handleViewSummary = (meetingId: string) => {
    // Navigate to view meeting summary
    window.open(`/meeting-summary?id=${meetingId}`, '_blank');
  };

  const handleMeetingDelete = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Meeting deleted successfully');
      await loadMeetingHistory();
    } catch (error: any) {
      toast.error(`Error deleting meeting: ${error.message}`);
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
      await loadMeetingHistory();
    } catch (error: any) {
      toast.error(`Error deleting meetings: ${error.message}`);
    }
  };

  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

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
          meeting_overviews(overview)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (meetingsData) {
        const meetingIds = meetingsData.map(m => m.id);
        
        const [transcriptCounts, summaryExists] = await Promise.all([
          supabase
            .from('meeting_transcripts')
            .select('meeting_id')
            .in('meeting_id', meetingIds)
            .then(({ data }) => {
              return data?.reduce((acc, t) => {
                acc[t.meeting_id] = (acc[t.meeting_id] || 0) + 1;
                return acc;
              }, {} as Record<string, number>) || {};
            }),
          
          supabase
            .from('meeting_summaries')
            .select('meeting_id')
            .in('meeting_id', meetingIds)
            .then(({ data }) => {
              return data?.reduce((acc, s) => {
                acc[s.meeting_id] = true;
                return acc;
              }, {} as Record<string, boolean>) || {};
            })
        ]);

        const enrichedMeetings = meetingsData.map(meeting => ({
          ...meeting,
          transcript_count: transcriptCounts[meeting.id] || 0,
          summary_exists: !!summaryExists[meeting.id]
        }));

        setMeetings(enrichedMeetings);
        filterMeetings();
      }
    } catch (error: any) {
      addDebugLog(`❌ Error loading meeting history: ${error.message}`);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filterMeetings = () => {
    let filtered = meetings;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(meeting =>
        meeting.title.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query) ||
        meeting.meeting_type.toLowerCase().includes(query) ||
        meeting.location?.toLowerCase().includes(query)
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter(meeting => meeting.meeting_type === filterType);
    }

    setFilteredMeetings(filtered);
  };

  // Load meeting history when tab is selected
  useEffect(() => {
    if (user) {
      loadMeetingHistory();
    }
  }, [user]);

  useEffect(() => {
    filterMeetings();
  }, [meetings, searchQuery, filterType]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20 p-4">
      <Tabs defaultValue="recording" className="w-full max-w-6xl mx-auto">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="recording">Record Meeting</TabsTrigger>
          <TabsTrigger value="test">Test Meeting Recorder</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="transcript">Live Transcript</TabsTrigger>
          <TabsTrigger value="history">Meeting History</TabsTrigger>
        </TabsList>

        {/* Record Meeting Tab */}
        <TabsContent value="recording" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Record Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground">Main recording functionality would go here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Recording Tab */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Test Meeting Recorder
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recording Mode Selection */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="font-medium">Recording Mode:</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={recordingMode === 'microphone' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRecordingMode('microphone')}
                    disabled={isRecording}
                  >
                    <Mic className="h-4 w-4 mr-2" />
                    Microphone Only
                  </Button>
                  <Button
                    variant={recordingMode === 'computer-audio' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRecordingMode('computer-audio')}
                    disabled={isRecording}
                  >
                    <Headphones className="h-4 w-4 mr-2" />
                    Dual Audio (System + Mic)
                  </Button>
                </div>
              </div>

              {/* Status and Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-2">
                      {getConnectionStatusIcon()}
                      <span className="text-sm font-medium">Status</span>
                    </div>
                    <Badge variant="secondary" className={getConnectionStatusColor()}>
                      {connectionStatus}
                    </Badge>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Duration</span>
                    </div>
                    <span className="text-lg font-mono">
                      {formatDuration(duration)}
                    </span>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Words</span>
                    </div>
                    <span className="text-lg font-semibold">{wordCount}</span>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">Speakers</span>
                    </div>
                    <span className="text-lg font-semibold">{speakerCount}</span>
                  </CardContent>
                </Card>
              </div>

              {/* Recording Controls */}
              <div className="text-center">
                {!isRecording ? (
                  <div className="space-y-2">
                    <Button 
                      onClick={() => {
                        console.log('🔥 BUTTON CLICKED!');
                        startTestRecording();
                      }}
                      size="lg"
                      className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                    >
                      {recordingMode === 'computer-audio' ? (
                        <>
                          <Headphones className="h-5 w-5 mr-2" />
                          Start Dual Audio Recording (System + Mic)
                        </>
                      ) : (
                        <>
                          <Mic className="h-5 w-5 mr-2" />
                          Start Microphone Recording
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={stopTestRecording}
                    size="lg"
                    variant="destructive"
                    className="px-8 py-4 text-base font-semibold rounded-lg"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop Recording
                  </Button>
                )}
              </div>

              {/* Live Transcript */}
              {isRecording && testTranscripts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Waves className="h-4 w-4" />
                      Live Transcript Ticker
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="overflow-hidden">
                      <div className="animate-scroll space-y-1">
                        {testTranscripts.map((transcript, index) => (
                          <div 
                            key={index} 
                            className="text-xs font-mono p-1 bg-background/50 rounded border border-border/30 whitespace-nowrap"
                          >
                            {transcript}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Debug Log */}
              {debugLog.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Debug Log</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {debugLog.map((log, index) => (
                        <div key={index} className="text-xs font-mono text-muted-foreground">
                          {log}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Settings Tab */}
        <TabsContent value="settings">
          <MeetingSettings
            onSettingsChange={(settings) => {
              console.log('Meeting settings changed:', settings);
            }}
            onAudioImported={handleAudioImported}
            onTranscriptImported={handleTranscriptImported}
            initialSettings={{
              title: "",
              description: "",
              meetingType: "general"
            }}
          />
        </TabsContent>

        {/* Live Transcript Tab */}
        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Live Transcript
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-lg min-h-[300px] max-h-[500px] overflow-y-auto">
                {transcript ? (
                  <pre className="whitespace-pre-wrap text-sm">{transcript}</pre>
                ) : (
                  <p className="text-muted-foreground">Start recording to see live transcript...</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Meeting History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Meeting History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Filters */}
              <MeetingSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterType={filterType}
                onFilterChange={setFilterType}
                advancedFilters={advancedFilters}
                onAdvancedFiltersChange={setAdvancedFilters}
                resultsCount={filteredMeetings.length}
              />
              
              {/* Multi-select controls */}
              {meetings.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSelectMode(!isSelectMode)}
                      className="flex items-center gap-2"
                    >
                      {isSelectMode ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                      {isSelectMode ? 'Cancel Selection' : 'Select Multiple'}
                    </Button>
                    
                    {isSelectMode && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAll}
                          className="flex items-center gap-2"
                        >
                          {selectedMeetings.length === filteredMeetings.length ? 'Deselect All' : 'Select All'}
                        </Button>
                        
                        {selectedMeetings.length > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelected}
                            className="flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Selected ({selectedMeetings.length})
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Meeting List */}
              <MeetingHistoryList
                meetings={filteredMeetings}
                onEdit={handleMeetingEdit}
                onViewSummary={handleViewSummary}
                onDelete={handleMeetingDelete}
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

export default MeetingRecorder;