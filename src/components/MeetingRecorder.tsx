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
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History, Search, Trash2, CheckSquare, SquareIcon, Monitor, Volume2, Waves, Video, Headphones, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";

import { supabase } from "@/integrations/supabase/client";
import { OpenAIRealtimeRecorder } from '../utils/OpenAIRealtimeRecorder';
import { HybridTranscriber } from '../utils/HybridTranscriber';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { DualStreamRecorder } from '@/utils/DualStreamRecorder';

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
  const [liveSummary, setLiveSummary] = useState<string>("");
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [testTranscripts, setTestTranscripts] = useState<string[]>([]);
  const [recordingMode, setRecordingMode] = useState<'microphone' | 'computer-audio' | 'testing' | 'ai-realtime' | 'hybrid'>('ai-realtime');
  
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
    title: "General Meeting",
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
  const dualStreamRecorderRef = useRef<DualStreamRecorder | null>(null);
  const openAIRealtimeRecorderRef = useRef<OpenAIRealtimeRecorder | null>(null);
  const hybridTranscriberRef = useRef<InstanceType<typeof HybridTranscriber> | null>(null);

  // Browser compatibility check
  const checkBrowserSupport = () => {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    
    const hasDisplayMedia = navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;
    const hasUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    
    return {
      isSupported: hasDisplayMedia && hasUserMedia && hasMediaRecorder,
      isRecommendedBrowser: isChrome || isEdge || isFirefox,
      browserName: isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : 'Unknown'
    };
  };

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const browserTranscriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const enhancedAudioCaptureRef = useRef<any>(null);

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

  const handleBrowserTranscript = (data: BrowserTranscriptData) => {
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
    setConnectionStatus(status);
    addDebugLog(`🔄 Status: ${status}`);
  };

  const handleLiveSummary = (summary: string) => {
    setLiveSummary(summary);
    addDebugLog(`📄 Summary generated (${summary.length} chars)`);
    toast.success("Live summary updated!");
  };

  const processAudioChunk = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) return;
    
    try {
      // Convert blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to prevent memory issues
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binary);

      // Send to speech-to-text edge function with optimized settings
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) {
        console.error('Transcription error:', error);
        return;
      }

      if (data?.text && data.text.trim() && !data.filtered) {
        const transcriptData: TranscriptData = {
          text: data.text.trim(),
          speaker: `Speaker ${speakerCount + 1}`,
          confidence: data.confidence || 0.8,
          timestamp: new Date().toISOString(),
          isFinal: true
        };
        
        handleTranscript(transcriptData);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  };

  // Browser speech transcription with microphone
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
    console.log('Recording started with microphone speech recognition');
  };

  // Computer audio transcription for Teams/Zoom meetings using enhanced audio processing
  const startComputerAudioTranscription = async () => {
    addDebugLog('💻 Starting computer audio capture via screen share...');
    
    try {
      // Try screen sharing with audio first
      let stream: MediaStream;
      let useCustomProcessing = false;
      
      try {
        addDebugLog('🖥️ Requesting screen share with audio...');
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Need video for screen share to work properly
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000
          }
        });
        
        addDebugLog('✅ Screen audio access granted');
        screenStreamRef.current = stream;
        
        // Check if we actually got audio tracks
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('No audio tracks in screen share');
        }
        
        addDebugLog(`🔊 Audio tracks found: ${audioTracks.length}`);
        
      } catch (screenError) {
        addDebugLog(`❌ Screen share failed: ${screenError.message}`);
        addDebugLog('🎤 Using enhanced microphone with custom audio processing...');
        
        // Fallback to microphone with custom audio processing
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2,
            sampleSize: 16
          }
        });
        
        addDebugLog('✅ Enhanced microphone access granted');
        micAudioStreamRef.current = stream;
        useCustomProcessing = true;
      }

      if (useCustomProcessing) {
        // Use custom audio processing for better speaker audio capture
        await startCustomAudioProcessing(stream);
      } else {
        // Use browser speech recognition for screen audio
        const transcriber = new BrowserSpeechTranscriber(
          handleBrowserTranscript,
          handleTranscriptionError,
          handleStatusChange,
          handleLiveSummary
        );

        await transcriber.startTranscription();
        browserTranscriberRef.current = transcriber;
      }
      
      addDebugLog('✅ Computer audio transcription started successfully');
      
      if (screenStreamRef.current) {
        addDebugLog('💡 Screen audio capture active - should pick up Teams/YouTube audio');
      } else {
        addDebugLog('💡 Using enhanced microphone processing - optimized for speaker audio capture');
      }
      
      console.log('Recording started with computer audio transcription');
      
    } catch (error: any) {
      addDebugLog(`❌ Computer audio setup failed: ${error.message}`);
      
      if (error.name === 'NotAllowedError') {
        throw new Error('Permission denied. Please allow screen sharing or microphone access to capture Teams/YouTube audio.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('No audio devices found. Please check your system audio settings.');
      } else {
        throw new Error(`Computer audio setup failed: ${error.message}. Try using microphone mode instead.`);
      }
    }
  };

  // Custom audio processing for enhanced speaker capture
  const startCustomAudioProcessing = async (stream: MediaStream) => {
    addDebugLog('🔧 Setting up custom audio processing pipeline...');
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create analyser for volume detection
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      // Volume monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        if (average > 10) {
          console.log(`Audio level detected: ${average.toFixed(1)}`);
          addDebugLog(`🔊 Audio activity: ${average.toFixed(1)}`);
        }
      };
      
      // Check audio levels every 2 seconds
      const audioMonitor = setInterval(checkVolume, 2000);
      
      // Set up MediaRecorder for transcription
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          processAudioChunk(event.data);
        }
      };
      
      mediaRecorder.start(5000); // Process every 5 seconds
      mediaRecorderRef.current = mediaRecorder;
      audioContextRef.current = audioContext;
      
      // Store cleanup function
      (mediaRecorder as any).cleanup = () => {
        clearInterval(audioMonitor);
        audioContext.close();
        stream.getTracks().forEach(track => track.stop());
      };
      
      addDebugLog('✅ Custom audio processing pipeline established');
      
    } catch (error: any) {
      addDebugLog(`❌ Custom audio processing failed: ${error.message}`);
      throw error;
    }
  };

  // Start OpenAI Realtime recording
  const startOpenAIRealtimeRecording = async () => {
    addDebugLog('🚀 Starting OpenAI Realtime recording...');
    console.log('🚀 Starting recording with AI Realtime Dual Audio (mic + speaker with 24kHz PCM)...');
    
    try {
      const recorder = new OpenAIRealtimeRecorder({
        onTranscript: (transcript: string) => {
          addDebugLog(`🎙️ Final: "${transcript}"`);
          console.log(`🎙️ Final: "${transcript}"`);
          
          // Update the main transcript
          setTranscript(transcript);
          onTranscriptUpdate(transcript);
          
          // Update word count
          const words = transcript.split(' ').filter(word => word.length > 0);
          setWordCount(words.length);
          onWordCountUpdate(words.length);
        },
        onStatusChange: (status: string) => {
          setConnectionStatus(status);
          addDebugLog(`🔄 Status: ${status}`);
        },
        onError: (error: string) => {
          console.error('OpenAI Realtime error:', error);
          setConnectionStatus('Error');
          addDebugLog(`❌ Error: ${error}`);
        }
      });
      
      recorder.startRecording();
      openAIRealtimeRecorderRef.current = recorder;
      
      addDebugLog('✅ OpenAI Realtime recording started successfully');
      
    } catch (error: any) {
      console.error('Failed to start OpenAI Realtime recording:', error);
      addDebugLog(`❌ Failed to start OpenAI Realtime recording: ${error.message}`);
      toast.error(`Failed to start OpenAI Realtime recording: ${error.message}`);
      throw error;
    }
  };

  // Function to start Hybrid recording (Browser + AI)
  const startHybridRecording = async () => {
    try {
      console.log('🎯 Starting Hybrid Recording...');
      addDebugLog('🎯 Starting Hybrid Recording...');
      
      hybridTranscriberRef.current = new HybridTranscriber({
        onTranscript: (data: any) => {
          const transcriptData: TranscriptData = {
            text: data.text,
            speaker: data.speaker || 'Speaker 1',
            confidence: data.confidence || 0.8,
            timestamp: new Date().toISOString(),
            isFinal: true
          };
          addDebugLog(`🔄 Hybrid: "${data.text}"`);
          handleTranscript(transcriptData);
        },
        onStatusChange: (status) => {
          setConnectionStatus(status);
          addDebugLog(`🔄 Status: ${status}`);
        },
        onError: (error) => {
          console.error('Hybrid error:', error);
          setConnectionStatus('Error');
          addDebugLog(`❌ Error: ${error}`);
        },
      });
      
      hybridTranscriberRef.current.startTranscription();
      
      addDebugLog('✅ Hybrid recording started successfully');
      
    } catch (error: any) {
      console.error('❌ Failed to start Hybrid recording:', error);
      addDebugLog(`❌ Failed to start Hybrid recording: ${error.message}`);
      toast.error(`Failed to start Hybrid recording: ${error.message}`);
      throw error;
    }
  };

  // Start recording based on selected mode
  const startRecording = async () => {
    if (!user) {
      toast.error("Please log in to start recording");
      return;
    }

    try {
      setIsRecording(true);
      setStartTime(new Date().toISOString());
      setConnectionStatus("Connecting...");
      setTranscript("");
      setWordCount(0);
      setSpeakerCount(0);
      setRealtimeTranscripts([]);
      
      addDebugLog(`🎬 Starting ${recordingMode} recording...`);
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          onDurationUpdate(formatDuration(newDuration));
          return newDuration;
        });
      }, 1000);

      switch (recordingMode) {
        case 'microphone':
          await startMicrophoneTranscription();
          break;
        case 'computer-audio':
          await startComputerAudioTranscription();
          break;
        case 'ai-realtime':
          await startOpenAIRealtimeRecording();
          break;
        case 'hybrid':
          await startHybridRecording();
          break;
        case 'testing':
          await startDualStreamRecording();
          break;
        default:
          throw new Error('Invalid recording mode');
      }
      
      const successMessage = 
        recordingMode === 'microphone' ? 'Recording started with microphone!' :
        recordingMode === 'computer-audio' ? 'Recording started with computer audio!' :
        recordingMode === 'ai-realtime' ? 'AI Realtime recording started!' :
        recordingMode === 'hybrid' ? 'Hybrid recording started!' :
        'Test recording started with microphone!';
      
      toast.success(successMessage);
      
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      addDebugLog(`❌ Failed to start: ${error.message}`);
      
      // Show browser-specific error messages
      if (error.message.includes('Permission denied')) {
        toast.error('Please allow microphone access and try again');
      } else if (error.message.includes('No audio devices')) {
        toast.error('No microphone found. Please connect a microphone and try again');
      } else {
        toast.error(`Recording failed: ${error.message}`);
      }
      
      // Reset recording state
      setIsRecording(false);
      setConnectionStatus('Error');
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  // Dual-stream recording for testing mode
  const startDualStreamRecording = async () => {
    addDebugLog('🎙️ Starting dual-stream recording (mic + speaker)...');
    
    try {
      dualStreamRecorderRef.current = new DualStreamRecorder({
        onTranscript: (transcript) => {
          addDebugLog(`📝 Dual-stream transcript: ${transcript.substring(0, 100)}...`);
          
          // Update the main transcript
          setTranscript(transcript);
          onTranscriptUpdate(transcript);
          
          // Update word count
          const words = transcript.split(' ').filter(word => word.length > 0);
          setWordCount(words.length);
          onWordCountUpdate(words.length);
          
          // Update speaker count (estimate from dual streams)
          setSpeakerCount(2); // Mic + Speaker = 2 sources
        },
        onStatusChange: (status) => {
          setConnectionStatus(status);
          addDebugLog(`🔄 Status: ${status}`);
        },
        onError: (error) => {
          console.error('Dual-stream error:', error);
          setConnectionStatus('Error');
          addDebugLog(`❌ Error: ${error}`);
        }
      });
      
      dualStreamRecorderRef.current.startRecording();
      
      addDebugLog('✅ Dual-stream recording started successfully');
      
    } catch (error: any) {
      addDebugLog(`❌ Dual-stream setup failed: ${error.message}`);
      throw error;
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      addDebugLog('🛑 Stopping recording...');
      console.log('Stopping recording...');
      
      setIsRecording(false);
      
      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Stop specific transcriber based on mode
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
        browserTranscriberRef.current = null;
      }
      
      if (dualStreamRecorderRef.current) {
        dualStreamRecorderRef.current.stopRecording();
        dualStreamRecorderRef.current = null;
      }
      
      if (openAIRealtimeRecorderRef.current) {
        openAIRealtimeRecorderRef.current.stopRecording();
        openAIRealtimeRecorderRef.current = null;
      }
      
      if (hybridTranscriberRef.current) {
        hybridTranscriberRef.current.stopTranscription();
        hybridTranscriberRef.current = null;
      }
      
      // Stop media recorder and cleanup
      if (mediaRecorderRef.current) {
        try {
          if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          
          // Execute cleanup function if available
          if ((mediaRecorderRef.current as any).cleanup) {
            (mediaRecorderRef.current as any).cleanup();
          }
        } catch (error) {
          console.warn('Error stopping media recorder:', error);
        }
        mediaRecorderRef.current = null;
      }
      
      // Clean up audio streams
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach(track => track.stop());
        micAudioStreamRef.current = null;
      }
      
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      
      if (audioContextRef.current) {
        try {
          await audioContextRef.current.close();
        } catch (error) {
          console.warn('Error closing audio context:', error);
        }
        audioContextRef.current = null;
      }
      
      setConnectionStatus('Disconnected');
      
      // Clear auto-saved meeting
      localStorage.removeItem('unsaved_meeting');
      
      console.log('Recording stopped');
      toast.success('Recording stopped successfully');
      
    } catch (error: any) {
      console.error('Failed to stop recording:', error);
      addDebugLog(`❌ Failed to stop: ${error.message}`);
      toast.error(`Failed to stop recording: ${error.message}`);
    }
  };

  // Generate meeting notes
  const generateMeetingNotes = async () => {
    if (!transcript || transcript.length < 50) {
      toast.error("Please record at least a few sentences before generating notes");
      return;
    }

    setIsGeneratingNotes(true);
    addDebugLog('📝 Generating meeting notes...');

    try {
      const { data, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: { 
          transcript: transcript,
          meetingType: meetingSettings.meetingType || 'general',
          title: meetingSettings.title || 'General Meeting',
          description: meetingSettings.description || ''
        }
      });

      if (error) {
        throw error;
      }

      if (!data?.summary) {
        throw new Error('Failed to generate meeting notes');
      }

      // Navigate to summary page with the generated data
      navigate('/meeting-summary', {
        state: {
          title: meetingSettings.title || 'General Meeting',
          duration: formatDuration(duration),
          wordCount: wordCount,
          transcript: transcript,
          summary: data.summary,
          speakerCount: speakerCount,
          startTime: startTime,
          meetingType: meetingSettings.meetingType || 'general'
        }
      });

      addDebugLog('✅ Meeting notes generated successfully');
      
    } catch (error: any) {
      console.error('Error generating meeting notes:', error);
      setIsGeneratingNotes(false);
      addDebugLog(`❌ Failed to generate notes: ${error.message}`);
      toast.error(`Failed to generate meeting notes: ${error.message}`);
    }
  };

  // Load meeting history
  const loadMeetingHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    
    try {
      const { data: meetingsData, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate word count for each meeting
      const meetingsWithCounts = (meetingsData || []).map(meeting => ({
        ...meeting,
        wordCount: meeting.transcript ? meeting.transcript.split(' ').filter((word: string) => word.length > 0).length : 0
      }));

      setMeetings(meetingsWithCounts);
      setFilteredMeetings(meetingsWithCounts);
      
    } catch (error: any) {
      console.error('Error loading meeting history:', error);
      toast.error('Failed to load meeting history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filter meetings based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredMeetings(meetings);
    } else {
      const filtered = meetings.filter(meeting =>
        meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meeting.transcript?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredMeetings(filtered);
    }
  }, [searchQuery, meetings]);

  // Load meeting history on component mount
  useEffect(() => {
    loadMeetingHistory();
  }, [user]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current);
      }
    };
  }, []);

  // Delete single meeting
  const deleteMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('Meeting deleted successfully');
      loadMeetingHistory(); // Reload the list
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      toast.error('Failed to delete meeting');
    }
  };

  // Delete selected meetings
  const deleteSelectedMeetings = async () => {
    if (selectedMeetings.length === 0) return;

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

  // Delete all meetings
  const deleteAllMeetings = async () => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success('All meetings deleted successfully');
      setSelectedMeetings([]);
      setIsSelectMode(false);
      loadMeetingHistory();
    } catch (error: any) {
      console.error("Error deleting all meetings:", error.message);
      toast.error("Failed to delete all meetings");
    }
  };

  const browserSupport = checkBrowserSupport();

  return (
    <div className="space-y-6">
      {/* Browser compatibility warning */}
      {!browserSupport.isSupported && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Browser Not Supported
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your browser doesn't support required features for audio recording. 
              Please use Chrome, Edge, or Firefox for the best experience.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recorder" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Recorder
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="space-y-4">
          {/* Recording Controls */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Meeting Recorder
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={connectionStatus === "Connected" ? "default" : connectionStatus === "Error" ? "destructive" : "secondary"}>
                    {connectionStatus === "Connected" ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                    {connectionStatus}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recording Mode Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Recording Mode:</label>
                <Select value={recordingMode} onValueChange={(value: any) => setRecordingMode(value)} disabled={isRecording}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai-realtime" className="flex items-center gap-2">
                      <Waves className="h-4 w-4" />
                      AI Realtime (Dual Audio) - RECOMMENDED
                    </SelectItem>
                    <SelectItem value="microphone" className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Microphone Only
                    </SelectItem>
                    <SelectItem value="computer-audio" className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Computer Audio (Teams/Zoom)
                    </SelectItem>
                    <SelectItem value="hybrid" className="flex items-center gap-2">
                      <Headphones className="h-4 w-4" />
                      Hybrid (Browser + AI)
                    </SelectItem>
                    <SelectItem value="testing" className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Testing (Dual Stream)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Meeting Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Meeting Title:</label>
                <Input
                  value={meetingSettings.title}
                  onChange={(e) => setMeetingSettings(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter meeting title..."
                  disabled={isRecording}
                />
              </div>

              {/* Recording Controls */}
              <div className="flex gap-4">
                {!isRecording ? (
                  <Button 
                    onClick={startRecording}
                    disabled={!browserSupport.isSupported}
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <Button 
                    onClick={stopRecording} 
                    variant="destructive"
                    className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop Recording
                  </Button>
                )}
                
                <Button 
                  onClick={generateMeetingNotes}
                  disabled={!transcript || transcript.length < 50 || isGeneratingNotes}
                  variant="outline"
                  className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  {isGeneratingNotes ? "Generating..." : "Generate Notes"}
                </Button>
              </div>

              {/* Recording Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="h-4 w-4" />
                    Duration
                  </div>
                  <div className="text-lg font-semibold">{formatDuration(duration)}</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    Words
                  </div>
                  <div className="text-lg font-semibold">{wordCount}</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    Speakers
                  </div>
                  <div className="text-lg font-semibold">{speakerCount}</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                    <Wifi className="h-4 w-4" />
                    Status
                  </div>
                  <div className="text-sm font-medium">{connectionStatus}</div>
                </div>
              </div>

              {/* Live Transcript */}
              {realtimeTranscripts.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Live Transcript:</label>
                  <div className="max-h-40 overflow-y-auto p-3 bg-muted rounded-lg">
                    {realtimeTranscripts.map((t, index) => (
                      <div key={index} className={`mb-2 ${t.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                        <span className="font-medium">{t.speaker}:</span> {t.text}
                        <span className="text-xs ml-2">({Math.round(t.confidence * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Debug Log */}
              {debugLog.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Debug Log:</label>
                  <div className="max-h-32 overflow-y-auto p-3 bg-muted rounded-lg text-xs font-mono">
                    {debugLog.map((log, index) => (
                      <div key={index} className="mb-1">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <MeetingHistoryList
            meetings={filteredMeetings}
            loading={loadingHistory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedMeetings={selectedMeetings}
            onMeetingSelect={setSelectedMeetings}
            isSelectMode={isSelectMode}
            onSelectModeChange={setIsSelectMode}
            onDeleteMeeting={deleteMeeting}
            onDeleteSelected={deleteSelectedMeetings}
            onDeleteAll={deleteAllMeetings}
            deleteConfirmation={deleteConfirmation}
            onDeleteConfirmationChange={setDeleteConfirmation}
          />
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <MeetingSettings
                settings={meetingSettings}
                onSettingsChange={setMeetingSettings}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <NotewellAIAnimation isVisible={isGeneratingNotes} />
    </div>
  );
};