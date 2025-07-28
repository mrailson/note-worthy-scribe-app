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
      
    } catch (error) {
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
          addDebugLog(`🔄 Dual-stream status: ${status}`);
        },
        onError: (error) => {
          addDebugLog(`❌ Dual-stream error: ${error}`);
          setConnectionStatus("Error");
          toast.error(`Dual-stream error: ${error}`);
        },
        chunkDuration: 5 // Process every 5 seconds
      });
      
      await dualStreamRecorderRef.current.startRecording();
      addDebugLog('✅ Dual-stream recording started successfully');
      
    } catch (error: any) {
      addDebugLog(`❌ Dual-stream setup failed: ${error.message}`);
      throw error;
    }
  };

  // Custom audio processing for better speaker audio capture
  const startCustomAudioProcessing = async (stream: MediaStream) => {
    addDebugLog('🔧 Starting custom audio processing...');
    
    try {
      // Create audio context for processing
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create a gain node to amplify speaker audio
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 10.0; // Much higher amplification for speaker audio
      
      // Create a processor for chunked audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      let audioBuffer: Float32Array[] = [];
      let bufferDuration = 0;
      const targetDuration = 3; // Process every 3 seconds
      
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Store audio data
        audioBuffer.push(new Float32Array(inputData));
        bufferDuration += inputBuffer.duration;
        
        // Process when we have enough audio
        if (bufferDuration >= targetDuration) {
          processAudioBuffer(audioBuffer, audioContext.sampleRate);
          audioBuffer = [];
          bufferDuration = 0;
        }
      };
      
      // Connect the audio pipeline
      source.connect(gainNode);
      gainNode.connect(processor);
      processor.connect(audioContext.destination);
      
      // Store references for cleanup
      audioContextRef.current = audioContext;
      
      addDebugLog('✅ Custom audio processing pipeline established');
      
    } catch (error) {
      addDebugLog(`❌ Custom audio processing failed: ${error.message}`);
      throw error;
    }
  };

  // Process audio buffer and send to speech-to-text API
  const processAudioBuffer = async (audioBuffer: Float32Array[], sampleRate: number) => {
    try {
      // Combine all audio chunks
      const totalLength = audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedBuffer = new Float32Array(totalLength);
      
      let offset = 0;
      for (const chunk of audioBuffer) {
        combinedBuffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      // Check if audio has sufficient volume (speaker audio detection)
      const rms = Math.sqrt(combinedBuffer.reduce((acc, val) => acc + val * val, 0) / combinedBuffer.length);
      const volumeThreshold = 0.001; // Much lower threshold for weak speaker audio
      
      if (rms < volumeThreshold) {
        addDebugLog(`🔇 Audio too quiet (RMS: ${rms.toFixed(6)}) - likely no speaker audio`);
        return;
      }
      
      addDebugLog(`🔊 Processing audio chunk (RMS: ${rms.toFixed(4)})`);
      
      // Convert to WAV format
      const wavBuffer = encodeWAV(combinedBuffer, sampleRate);
      const base64Audio = arrayBufferToBase64(wavBuffer);
      
      // Send to speech-to-text edge function
      const response = await fetch('/functions/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ audio: base64Audio })
      });
      
      if (!response.ok) {
        throw new Error(`Speech-to-text API error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.text && result.text.trim()) {
        addDebugLog(`🎙️ Custom: "${result.text}"`);
        const transcriptData: TranscriptData = {
          text: result.text,
          speaker: 'Speaker Audio',
          isFinal: true,
          confidence: 0.85,
          timestamp: new Date().toISOString()
        };
        handleTranscript(transcriptData);
      }
      
    } catch (error) {
      addDebugLog(`❌ Audio processing error: ${error.message}`);
    }
  };

  // Encode Float32Array to WAV format
  const encodeWAV = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    
    // Convert samples to 16-bit PCM
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }
    
    return buffer;
  };

  // Convert ArrayBuffer to Base64
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const startOpenAIRealtimeRecording = async () => {
    console.log('🚀 Starting OpenAI Realtime recording (mic + speaker with 24kHz PCM)...');
    addDebugLog('🚀 Starting OpenAI Realtime recording (mic + speaker with 24kHz PCM)...');
    
    try {
      // Import the OpenAI Realtime Recorder
      const { OpenAIRealtimeRecorder } = await import('../utils/OpenAIRealtimeRecorder');
      
      openAIRealtimeRecorderRef.current = new OpenAIRealtimeRecorder({
        onTranscript: (transcript, isFinal) => {
          console.log('🎤 OpenAI Realtime transcript:', { transcript, isFinal });
          if (isFinal) {
            setTranscript(prev => prev + ' ' + transcript);
            addDebugLog(`🎤 Transcript: "${transcript}"`);
          }
        },
        onStatusChange: (status) => {
          console.log('📊 OpenAI Realtime Status:', status);
          addDebugLog(`📊 Status: ${status}`);
        },
        onError: (error) => {
          console.error('❌ OpenAI Realtime Error:', error);
          addDebugLog(`❌ Error: ${error}`);
          toast.error(`OpenAI Realtime Error: ${error}`);
        }
      });
      
      await openAIRealtimeRecorderRef.current.startRecording();
      
      setIsRecording(true);
      addDebugLog('✅ OpenAI Realtime recording started successfully');
      
    } catch (error) {
      console.error('Failed to start OpenAI Realtime recording:', error);
      addDebugLog(`❌ Failed to start OpenAI Realtime recording: ${error.message}`);
      toast.error(`Failed to start OpenAI Realtime recording: ${error.message}`);
      throw error;
    }
  };
  // Function to start Hybrid recording (Browser + AI)
          console.log(`Audio level detected: ${average.toFixed(1)}`);
          addDebugLog(`🔊 Audio activity: ${average.toFixed(1)}`);
        }
      };
      
      // Check audio levels every 2 seconds
      const audioMonitor = setInterval(monitorAudio, 2000);
      
      // Store cleanup function
      const originalCleanup = () => {
        clearInterval(audioMonitor);
        audioContext.close();
        displayStream.getTracks().forEach(track => {
          track.stop();
          addDebugLog(`🔇 Stopped display track: ${track.kind}`);
        });
        micStream.getTracks().forEach(track => {
          track.stop();
          addDebugLog(`🔇 Stopped mic track: ${track.kind}`);
        });
        combinedStream.getTracks().forEach(track => {
          track.stop();
        });
  };

  // Function to start Hybrid recording (Browser + AI)
  const startHybridRecording = async () => {
    try {
      console.log('🎯 Starting Hybrid Recording...');
      addDebugLog('🎯 Starting Hybrid Recording...');
      
      hybridTranscriberRef.current = new HybridTranscriber({
        onTranscript: (data) => {
          console.log('📝 Hybrid Transcript received:', data);
          // We'll handle individual transcripts but mainly use combined
        },
        onCombinedTranscript: (combinedTranscript) => {
          console.log('📝 Combined transcript updated:', combinedTranscript.length);
          setTranscript(combinedTranscript);
        },
        onStatusChange: (status) => {
          console.log('📊 Hybrid Status:', status);
          addDebugLog(`📊 Hybrid Status: ${status}`);
        },
        onError: (error) => {
          console.error('❌ Hybrid Error:', error);
          addDebugLog(`❌ Hybrid Error: ${error}`);
          toast.error(`Hybrid Error: ${error}`);
        }
      });

      await hybridTranscriberRef.current.startTranscription();
      console.log('✅ Hybrid recording started successfully');
      addDebugLog('✅ Hybrid recording started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Hybrid recording:', error);
      addDebugLog(`❌ Failed to start Hybrid recording: ${error.message}`);
      toast.error(`Failed to start Hybrid recording: ${error.message}`);
      throw error;
    }
  };
      
      // Debug: Check if tracks are active and have audio
      combinedStream.getTracks().forEach((track, index) => {
        console.log(`Track ${index}:`, {
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted,
          label: track.label
        });
        addDebugLog(`🎵 Track ${index}: ${track.kind} - ${track.readyState} - ${track.enabled ? 'enabled' : 'disabled'}`);
      });

      // Step 4: Set up MediaRecorder with simple, compatible settings
      let mimeType = 'audio/webm';
      let bitrate = 128000;
      
      // Check what's actually supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
          addDebugLog('⚠️ Using MP4 format for compatibility');
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
          addDebugLog('⚠️ Using OGG format for compatibility');
        } else {
          // Use default, let browser decide
          mimeType = '';
          bitrate = undefined;
          addDebugLog('⚠️ Using browser default audio format');
        }
      }
      
      console.log('Using MediaRecorder with:', { mimeType, bitrate });
      
      const mediaRecorderOptions: any = {};
      if (mimeType) mediaRecorderOptions.mimeType = mimeType;
      if (bitrate) mediaRecorderOptions.audioBitsPerSecond = bitrate;
      
      const mediaRecorder = new MediaRecorder(combinedStream, mediaRecorderOptions);
      addDebugLog(`📹 MediaRecorder created with ${mimeType || 'default'} format`);
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('MediaRecorder data available:', {
          dataSize: event.data.size,
          type: event.data.type,
          timestamp: new Date().toISOString()
        });
        
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          addDebugLog(`📦 Audio chunk captured: ${(event.data.size / 1024).toFixed(1)}KB`);
        } else {
          addDebugLog(`⚠️ Empty audio chunk received`);
        }
      };

      mediaRecorder.onstop = async () => {
        addDebugLog('🔄 Processing recorded audio...');
        
        try {
          // Create the final audio blob
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          addDebugLog(`📁 Final audio file: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB`);

          // Upload to Supabase Edge Function for processing
          addDebugLog('☁️ Uploading to backend for transcription...');
          const formData = new FormData();
          formData.append('audio', audioBlob, 'meeting.webm');

          const { data, error } = await supabase.functions.invoke('process-meeting-audio', {
            body: formData,
          });

          if (error) {
            throw new Error(`Backend error: ${error.message}`);
          }

          if (data.success) {
            addDebugLog('✅ Processing completed successfully!');
            
            // Display the transcript
            handleBrowserTranscript({
              text: data.transcript,
              is_final: true,
              confidence: 0.95,
              speaker: 'Meeting Audio'
            });

            // Show meeting summary if available
            if (data.summary) {
              console.log('Meeting Summary:', data.summary);
              addDebugLog('📋 Meeting summary generated - check console for details');
            }
            
            toast.success('Meeting processed! Check transcript below.');
            
          } else {
            throw new Error(data.error || 'Processing failed');
          }

        } catch (uploadError) {
          addDebugLog(`❌ Upload/Processing failed: ${uploadError.message}`);
          toast.error(`Processing failed: ${uploadError.message}`);
        }
      };

      mediaRecorder.onerror = (event) => {
        addDebugLog(`❌ MediaRecorder error: ${event}`);
      };

      // Start recording with more frequent data collection and debugging
      console.log('Starting MediaRecorder...');
      addDebugLog('🎯 Starting MediaRecorder with 5-second intervals');
      
      // Check if the stream is actually active before starting
      const activeTracks = combinedStream.getTracks().filter(track => track.readyState === 'live');
      console.log(`Active tracks before recording: ${activeTracks.length}`);
      addDebugLog(`🟢 ${activeTracks.length} active tracks ready for recording`);
      
      if (activeTracks.length === 0) {
        throw new Error('No active audio tracks available for recording');
      }
      
      mediaRecorder.start(5000); // Capture data every 5 seconds for more responsive feedback
      addDebugLog('🎯 Advanced dual audio recording started');

      // Store references for cleanup
      micAudioStreamRef.current = combinedStream;
      mediaRecorderRef.current = mediaRecorder;
      
      // Store cleanup function
      (mediaRecorder as any).cleanup = originalCleanup;

    } catch (error) {
      console.error('Dual audio capture error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      addDebugLog(`❌ Advanced dual audio capture failed: ${error.message}`);
      
      // Try fallback to microphone-only mode
      if (error.name === 'NotSupportedError' || error.message.includes('not supported')) {
        addDebugLog('🔄 Attempting fallback to microphone-only recording...');
        toast.info('Dual audio not supported. Falling back to microphone-only recording.');
        
        try {
          // Fallback to simple microphone recording
          await startMicrophoneTranscription();
          return; // Success with fallback
        } catch (fallbackError) {
          addDebugLog(`❌ Microphone fallback also failed: ${fallbackError.message}`);
          error = fallbackError; // Use the fallback error for final error handling
        }
      }
      
      // Provide specific, helpful error messages
      if (error.name === 'NotAllowedError') {
        toast.error('Permission denied. Please allow screen sharing and microphone access when prompted.');
        addDebugLog('💡 Tip: Click the address bar and enable camera/microphone permissions for this site');
      } else if (error.name === 'NotFoundError') {
        toast.error('No audio source found. Please ensure your microphone is connected and working.');
      } else if (error.name === 'NotSupportedError') {
        toast.error('Screen audio capture not supported in this browser. Please try Chrome or Edge, or use microphone-only mode.');
        addDebugLog('💡 Tip: Try using the regular "Microphone Only" recording mode instead');
      } else if (error.name === 'AbortError') {
        toast.error('Recording was cancelled. Please try again and select a window/tab to share.');
      } else if (error.message.includes('audio')) {
        toast.error('Audio capture failed. Please check your audio settings and try again.');
      } else if (error.message.includes('browser')) {
        toast.error(error.message);
      } else {
        toast.error(`Recording failed: ${error.message}`);
      }
      
      // Reset recording state
      setIsRecording(false);
      setConnectionStatus('Error');
      
      throw error;
    }
  };

  const processRecordedAudio = async (base64Audio: string) => {
    try {
      addDebugLog('🤖 Sending audio to transcription service...');
      
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audio: base64Audio }
      });

      if (error) throw error;

      addDebugLog('✅ Transcription received');
      handleBrowserTranscript({
        text: data.text,
        is_final: true,
        confidence: 0.95,
        speaker: 'Mixed Audio'
      });

    } catch (error) {
      addDebugLog(`❌ Transcription failed: ${error.message}`);
    }
  };

  const startTestRecording = async () => {
    try {
      const modeText = recordingMode === 'computer-audio' ? 'dual audio (system + microphone)' : 'microphone';
      addDebugLog(`🚀 Starting test recording with ${modeText}...`);
      console.log(`Starting test recording with ${modeText}...`);
      
      // Clear previous debug logs and test transcripts
      setDebugLog([]);
      setTestTranscripts([]);
      
      // Choose recording method based on mode
      if (recordingMode === 'computer-audio') {
        await startDualStreamRecording(); // Use our new advanced dual audio function
      } else {
        await startMicrophoneTranscription();
      }
      
      setIsRecording(true);
      setRealtimeTranscripts([]);
      setSpeakerCount(1);
      setStartTime(new Date().toISOString());
      setConnectionStatus("Connected");
      
      addDebugLog('✅ Test recording started successfully');
      
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

  // Function to start Hybrid recording (Browser + AI)
  const startHybridRecording = async () => {
    try {
      console.log('🎯 Starting Hybrid Recording...');
      addDebugLog('🎯 Starting Hybrid Recording...');
      
      hybridTranscriberRef.current = new HybridTranscriber({
        onTranscript: (data) => {
          console.log('📝 Hybrid Transcript received:', data);
        },
        onCombinedTranscript: (combinedTranscript) => {
          console.log('📝 Combined transcript updated:', combinedTranscript.length);
          setTranscript(combinedTranscript);
        },
        onStatusChange: (status) => {
          console.log('📊 Hybrid Status:', status);
          addDebugLog(`📊 Hybrid Status: ${status}`);
        },
        onError: (error) => {
          console.error('❌ Hybrid Error:', error);
          addDebugLog(`❌ Hybrid Error: ${error}`);
          toast.error(`Hybrid Error: ${error}`);
        }
      });

      await hybridTranscriberRef.current.startTranscription();
      console.log('✅ Hybrid recording started successfully');
      addDebugLog('✅ Hybrid recording started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Hybrid recording:', error);
      addDebugLog(`❌ Failed to start Hybrid recording: ${error.message}`);
      toast.error(`Failed to start Hybrid recording: ${error.message}`);
      throw error;
    }
  };

  const stopTestRecording = async () => {
    try {
      addDebugLog('🛑 Stopping test recording...');
      
      // Stop MediaRecorder if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        
        // Clean up streams if cleanup function exists
        if ((mediaRecorderRef.current as any).cleanup) {
          (mediaRecorderRef.current as any).cleanup();
        }
      }
      
      // Stop other streams
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getTracks().forEach(track => track.stop());
        micAudioStreamRef.current = null;
      }
      
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
      
      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setIsRecording(false);
      setConnectionStatus("Disconnected");
      addDebugLog('✅ Test recording stopped');
      toast.success('Test recording stopped successfully');
      
    } catch (error: any) {
      console.error('Failed to stop test recording:', error);
      addDebugLog(`❌ Failed to stop test: ${error.message}`);
      toast.error('Failed to stop test recording');
    }
  };

  const startRecording = async () => {
    try {
      let modeText = '';
      switch (recordingMode) {
        case 'ai-realtime':
          modeText = 'AI Realtime Dual Audio (mic + speaker with 24kHz PCM)';
          break;
        case 'hybrid':
          modeText = 'Hybrid (Browser mic + AI speaker audio)';
          break;
        case 'computer-audio':
          modeText = 'computer audio for Teams/Zoom';
          break;
        case 'testing':
          modeText = 'dual-stream (microphone + speaker)';
          break;
        default:
          modeText = 'microphone';
      }
      
      addDebugLog(`🚀 Starting recording with ${modeText}...`);
      console.log(`Starting recording with ${modeText}...`);
      
      // Clear previous debug logs and test transcripts
      setDebugLog([]);
      setTestTranscripts([]);
      
      // Choose transcription method based on recording mode
      if (recordingMode === 'ai-realtime') {
        await startOpenAIRealtimeRecording();
      } else if (recordingMode === 'hybrid') {
        await startHybridRecording();
      } else if (recordingMode === 'computer-audio') {
        await startComputerAudioTranscription();
      } else if (recordingMode === 'testing') {
        await startDualStreamRecording();
      } else {
        await startMicrophoneTranscription();
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

      let successMessage = '';
      switch (recordingMode) {
        case 'ai-realtime':
          successMessage = 'AI Realtime recording started! Capturing both mic and speaker audio with OpenAI API.';
          break;
        case 'hybrid':
          successMessage = 'Hybrid recording started! Using browser mic + AI speaker audio.';
          break;
        case 'computer-audio':
          successMessage = 'Recording started with computer audio for Teams/Zoom!';
          break;
        case 'testing':
          successMessage = 'Dual-stream recording started! Recording both mic and speaker audio.';
          break;
        default:
          successMessage = 'Recording started with microphone!';
      }
      toast.success(successMessage);
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
    
    // Stop screen stream (computer audio)
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    // Stop browser transcriber
    if (browserTranscriberRef.current) {
      browserTranscriberRef.current.stopTranscription();
      browserTranscriberRef.current = null;
    }
    
    // Stop dual-stream recorder
    if (dualStreamRecorderRef.current) {
      await dualStreamRecorderRef.current.stopRecording();
      dualStreamRecorderRef.current = null;
      addDebugLog('✅ Dual-stream recording stopped');
    }

    // Stop hybrid transcriber
    if (hybridTranscriberRef.current) {
      await hybridTranscriberRef.current.stopTranscription();
      hybridTranscriberRef.current = null;
      addDebugLog('✅ Hybrid transcription stopped');
    }
    
    // Stop OpenAI Realtime Recorder
    if (openAIRealtimeRecorderRef.current) {
      await openAIRealtimeRecorderRef.current.stopRecording();
      openAIRealtimeRecorderRef.current = null;
      addDebugLog('✅ OpenAI Realtime recording stopped');
    }
    
    // Stop enhanced audio capture
    if (enhancedAudioCaptureRef.current) {
      enhancedAudioCaptureRef.current.stopCapture();
      enhancedAudioCaptureRef.current = null;
    }
    
    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsRecording(false);
    setConnectionStatus("Disconnected");
    
    // Clear unsaved meeting data when stopping normally
    localStorage.removeItem('unsaved_meeting');
    
    console.log('Recording stopped');
    toast.success('Recording stopped');
    
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
    
    // Prepare meeting data
    const meetingData = {
      title: initialSettings?.title || 'General Meeting',
      duration: formatDuration(duration),
      wordCount: wordCount,
      transcript: transcript,
      speakerCount: speakerCount,
      startTime: startTime
    };

    // Show Notewell AI animation
    setIsGeneratingNotes(true);

    try {
      // Call the generate-meeting-minutes edge function
      const { data: minutesData, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: {
          transcript: transcript,
          meetingTitle: meetingData.title,
          meetingDate: new Date().toLocaleDateString(),
          meetingTime: new Date().toLocaleTimeString()
        }
      });

      if (error) {
        throw error;
      }

      if (minutesData?.success && minutesData?.meetingMinutes) {
        // Add the generated meeting notes to the meeting data
        const enhancedMeetingData = {
          ...meetingData,
          generatedNotes: minutesData.meetingMinutes
        };

        setIsGeneratingNotes(false);
        toast.success('Meeting notes generated successfully!');
        
        // Navigate to meeting summary with data and generated notes
        navigate('/meeting-summary', { state: enhancedMeetingData });
      } else {
        throw new Error('Failed to generate meeting notes');
      }
    } catch (error) {
      console.error('Error generating meeting notes:', error);
      setIsGeneratingNotes(false);
      toast.error('Failed to generate meeting notes. Proceeding without AI notes.');
      
      // Still navigate to meeting summary even if note generation fails
      navigate('/meeting-summary', { state: meetingData });
    }
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
            <Mic style={{ width: '20px', height: '20px', color: '#0066cc', display: 'block' }} />
            <span className="hidden sm:inline">Meeting Recorder</span>
            <span className="sm:hidden">Record</span>
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <FileText style={{ width: '20px', height: '20px', color: '#0066cc', display: 'block' }} />
            <span className="hidden sm:inline">Live Transcript</span>
            <span className="sm:hidden">Transcript</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings style={{ width: '20px', height: '20px', color: '#0066cc', display: 'block' }} />
            <span className="hidden sm:inline">Meeting Settings</span>
            <span className="sm:hidden">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History style={{ width: '20px', height: '20px', color: '#0066cc', display: 'block' }} />
            <span className="hidden sm:inline">Meeting History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
        </TabsList>

        {/* Meeting Recorder Tab - ONLY recording controls */}
        <TabsContent value="recorder" className="space-y-6 mt-6">
          <div className="space-y-4">
            {/* Compact Stats Dashboard */}
            <Card className="bg-gradient-to-br from-background to-muted/30">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-3 gap-3">
                  {/* Duration */}
                  <div className="text-center p-3 bg-background/50 rounded-lg border border-border/50">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {formatDuration(duration)}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">Duration</div>
                  </div>
                  
                  {/* Word Count */}
                  <div className="text-center p-3 bg-background/50 rounded-lg border border-border/50">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {wordCount}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">Words</div>
                  </div>
                  
                  {/* Connection Status */}
                  <div className="text-center p-3 bg-background/50 rounded-lg border border-border/50">
                    <div className="flex items-center justify-center mb-1">
                      <Badge variant={getConnectionStatusColor() as any} className="flex items-center gap-1 text-xs px-2 py-1">
                        {getConnectionStatusIcon()}
                        <span className="hidden sm:inline">{connectionStatus}</span>
                      </Badge>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">Connection</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compact Recording Controls */}
            <Card className="shadow-lg">
              <CardContent className="pt-4 pb-4">
                {/* Recording Mode Selection */}
                {!isRecording && (
                  <div className="space-y-3 mb-4 flex flex-col items-center">
                    <label className="text-sm font-medium">Recording Source:</label>
                    <Select value={recordingMode} onValueChange={(value: 'microphone' | 'computer-audio' | 'testing' | 'ai-realtime' | 'hybrid') => setRecordingMode(value)}>
                      <SelectTrigger className="w-[50%] bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border shadow-lg z-50">
                        <SelectItem value="ai-realtime" className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-green-600" />
                            <div>
                              <div className="font-medium">AI Realtime (Dual Audio) - RECOMMENDED</div>
                              <div className="text-xs text-muted-foreground">Microphone + Speaker audio with OpenAI 24kHz PCM</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="hybrid" className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 text-orange-600" />
                            <div>
                              <div className="font-medium">Hybrid (Experimental)</div>
                              <div className="text-xs text-muted-foreground">Browser mic + AI speaker audio - may have connection issues</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="microphone" className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Microphone</div>
                              <div className="text-xs text-muted-foreground">Record from your microphone</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="computer-audio" className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Headphones className="h-4 w-4" />
                            <div className="flex-1">
                              <div className="font-medium">Teams/Zoom Meeting</div>
                              <div className="text-xs text-muted-foreground">Capture computer audio from Teams/Zoom</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="testing" className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4" />
                            <div>
                              <div className="font-medium">Just for Testing</div>
                              <div className="text-xs text-muted-foreground">Test microphone recording functionality</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {recordingMode === 'computer-audio' && (
                      <div className="p-3 bg-red-50/50 border border-red-200/50 rounded-lg dark:bg-red-900/20 dark:border-red-700/50">
                        <div className="flex items-start gap-2">
                          <Video className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-red-700 dark:text-red-300">
                            <strong className="text-red-800 dark:text-red-200">🚧 Development Notice:</strong> 
                            <br />• This feature is currently being developed
                            <br />• Expected release: <strong>10th August 2025</strong>
                             <br />• You can record through the smartphone version and transcripts will be saved here
                             <br />• You can still use microphone mode for general audio recording (ie Face 2 Face or via conference phone etc)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Recording Button */}
                <div className="text-center">
                  {!isRecording ? (
                    <div className="space-y-2">
                      <Button 
                        onClick={startRecording}
                        size="lg"
                        disabled={recordingMode === 'computer-audio'}
                        className={`${recordingMode === 'computer-audio' 
                          ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                          : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary'
                        } text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg`}
                      >
                        {recordingMode === 'computer-audio' ? (
                          <>
                            <Headphones className="h-5 w-5 mr-2" />
                            Start Recording Teams/Zoom (Coming Soon)
                          </>
                        ) : (
                          <>
                            <Mic className="h-5 w-5 mr-2" />
                            Start Recording
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-3 text-primary animate-pulse bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-base font-semibold">Recording in progress...</span>
                      </div>
                      
                      <Button 
                        onClick={stopRecording}
                        variant="destructive"
                        size="lg"
                        className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        Stop Recording
                      </Button>
                    </div>
                  )}
                </div>

                {/* Compact Welcome Message */}
                {!isRecording && (
                  <div className="text-center py-4 mt-4 border-t border-border/50">
                    <div className="max-w-sm mx-auto">
                      <div className="p-2 rounded-full bg-primary/5 w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                        <Mic className="h-6 w-6 text-primary/60" />
                      </div>
                       <h4 className="text-base font-medium mb-1">Ready to Record</h4>
                       <p className="text-xs text-muted-foreground">
                         Automatic microphone + system audio capture with live AI summaries
                       </p>
                       
                       {/* Live Summary Display */}
                       {liveSummary && (
                         <Card className="mt-4 bg-gradient-to-br from-accent/20 to-accent/10 border-accent/30">
                           <CardHeader className="pb-2">
                             <CardTitle className="text-sm font-medium flex items-center gap-2">
                               <Waves className="h-4 w-4" />
                               Live Summary
                             </CardTitle>
                           </CardHeader>
                           <CardContent className="pt-0">
                             <p className="text-xs text-muted-foreground leading-relaxed">
                               {liveSummary}
                             </p>
                           </CardContent>
                         </Card>
                       )}
                    </div>
                  </div>
                )}


                {/* Ticker Tape Test Transcript */}
                {testTranscripts.length > 0 && (
                  <Card className="mt-4 bg-gradient-to-br from-green-50/50 to-green-100/50 border-green-200/50 dark:from-green-900/20 dark:to-green-800/20 dark:border-green-700/50">
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
      
      <NotewellAIAnimation isVisible={isGeneratingNotes} />
    </div>
  );
};