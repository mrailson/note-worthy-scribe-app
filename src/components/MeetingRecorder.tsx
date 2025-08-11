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
import { Mic, MicOff, Play, Square, Clock, Users, Wifi, WifiOff, FileText, Settings, History, Search, Trash2, CheckSquare, SquareIcon, Monitor, Volume2, Waves, Video, Headphones, AlertCircle, Eye, EyeOff, RotateCcw, MonitorSpeaker, RefreshCw, Sparkles, Pause } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MeetingSettings } from "@/components/MeetingSettings";
import { MeetingHistoryList } from "@/components/MeetingHistoryList";
import { WhisperHallucinationTestSuite } from "@/components/WhisperHallucinationTestSuite";
import { MicInputRecordingTester } from "@/components/MicInputRecordingTester";
import { SharedMeetingsManager } from "@/components/SharedMeetingsManager";
import { LiveTranscript } from "@/components/LiveTranscript";

import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { iPhoneWhisperTranscriber, TranscriptData as iPhoneTranscriptData } from '@/utils/iPhoneWhisperTranscriber';
import { DesktopWhisperTranscriber, TranscriptData as DesktopTranscriptData } from '@/utils/DesktopWhisperTranscriber';
import { IncrementalTranscriptHandler, IncrementalTranscriptData } from '@/utils/IncrementalTranscriptHandler';
import { StereoAudioCapture } from '@/utils/StereoAudioCapture';
import { transcriptCleaner, RemovedSegment } from '@/utils/TranscriptCleaner';

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
  const [removedSegments, setRemovedSegments] = useState<RemovedSegment[]>([]);
  
  // Update removed segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setRemovedSegments(transcriptCleaner.getRemovedSegments());
    }, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");
  const [speakerCount, setSpeakerCount] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [showLastPhrase, setShowLastPhrase] = useState(false);
  const [lastPhrase, setLastPhrase] = useState("");
  
  // Mic test service visibility (controls both tab and recording playback)
  const [micTestServiceVisible, setMicTestServiceVisible] = useState<boolean>(true);
  const [startTime, setStartTime] = useState<string>("");
  const [liveSummary, setLiveSummary] = useState<string>("");
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [testTranscripts, setTestTranscripts] = useState<string[]>([]);
  
  const [tickerText, setTickerText] = useState<string>("");
  const [showTicker, setShowTicker] = useState(false);
  const [tickerEnabled, setTickerEnabled] = useState(true);
  
  // Transcript snippet state
  const [transcriptSnippet, setTranscriptSnippet] = useState<string>("");
  const [showTranscriptSnippet, setShowTranscriptSnippet] = useState(false);
  const [firstTranscriptionReceived, setFirstTranscriptionReceived] = useState(false);
  const transcriptSnippetIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  
  // Meeting settings
  const [meetingSettings, setMeetingSettings] = useState(() => initialSettings || {
    title: "General Meeting",
    description: "",
    meetingType: "general",
    practiceId: "",
    meetingFormat: "teams"
  });

  // Reset meeting function
  const resetMeeting = async () => {
    // Stop any ongoing recordings first
    if (isRecording) {
      await stopRecording();
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    setDuration(0);
    setTranscript("");
    setRealtimeTranscripts([]);
    setConnectionStatus("Disconnected");
    setSpeakerCount(0);
    setWordCount(0);
    setLastPhrase("");
    setStartTime("");
    setLiveSummary("");
    setDebugLog([]);
    setTestTranscripts([]);
    setTickerText("");
    setShowTicker(false);
    setTranscriptSnippet("");
    setShowTranscriptSnippet(false);
    setSelectedMeetings([]);
    setIsSelectMode(false);
    setDeleteConfirmation("");
    setMeetingSettings({
      title: "General Meeting",
      description: "",
      meetingType: "general",
      practiceId: "",
      meetingFormat: "teams"
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
    
    if (iPhoneTranscriberRef.current) {
      iPhoneTranscriberRef.current.stopTranscription();
      iPhoneTranscriberRef.current = null;
    }
    
    if (desktopTranscriberRef.current) {
      await desktopTranscriberRef.current.stopTranscription();
      desktopTranscriberRef.current = null;
    }
    
    // Clear recording audio if playing
    if (recordingAudioRef.current) {
      recordingAudioRef.current.pause();
      recordingAudioRef.current.currentTime = 0;
    }
    if (micAudioRef.current) {
      micAudioRef.current.pause();
      micAudioRef.current.currentTime = 0;
    }
    if (systemAudioRef.current) {
      systemAudioRef.current.pause();
      systemAudioRef.current.currentTime = 0;
    }
    setRecordingAudioUrl(null);
    setMicAudioUrl(null);
    setSystemAudioUrl(null);
    setRecordingBlob(null);
    setMicBlob(null);
    setSystemBlob(null);
    
    // Clear transcript snippet interval
    if (transcriptSnippetIntervalRef.current) {
      clearInterval(transcriptSnippetIntervalRef.current);
      transcriptSnippetIntervalRef.current = null;
    }
    
    console.log('🔄 Meeting reset completed');
    toast.success("Meeting reset - ready for new recording");
    
    // Refresh page after a short delay to let the toast display
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };
  
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const latestCompleteTranscriptRef = useRef<string>('');
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const browserAudioStreamRef = useRef<MediaStream | null>(null);
  const micAudioStreamRef = useRef<MediaStream | null>(null);
  const transcriptHandler = useRef<IncrementalTranscriptHandler | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  // Progressive pre-summaries ingestion state
  const ingestedKeysRef = useRef<Set<string>>(new Set());
  // Audio backup recording refs
  const audioBackupRecorder = useRef<MediaRecorder | null>(null);
  const audioBackupChunks = useRef<Blob[]>([]);
  const audioBackupStream = useRef<MediaStream | null>(null);
  
  // Recording playback refs
  const [recordingAudioUrl, setRecordingAudioUrl] = useState<string | null>(null);
  const [micAudioUrl, setMicAudioUrl] = useState<string | null>(null);
  const [systemAudioUrl, setSystemAudioUrl] = useState<string | null>(null);
  
  // Store actual blobs for saving to database
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [micBlob, setMicBlob] = useState<Blob | null>(null);
  const [systemBlob, setSystemBlob] = useState<Blob | null>(null);
  
  const recordingAudioRef = useRef<HTMLAudioElement | null>(null);
  const micAudioRef = useRef<HTMLAudioElement | null>(null);
  const systemAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio segment recording refs
  const audioSegmentRecorder = useRef<MediaRecorder | null>(null);
  const audioSegmentChunks = useRef<Blob[]>([]);
  const segmentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSegmentNumber = useRef<number>(1);
  const segmentStartTime = useRef<Date>(new Date());
  
  // 5-second chunking with 2-second overlap refs
  const chunkRecorders = useRef<Map<number, MediaRecorder>>(new Map());
  const chunkData = useRef<Map<number, Blob[]>>(new Map());
  const chunkIntervals = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const chunkStartTimes = useRef<Map<number, Date>>(new Map());
  
  // Stereo audio capture ref
  const stereoAudioCapture = useRef(new StereoAudioCapture());
  const stereoRecorder = useRef<MediaRecorder | null>(null);
  const stereoChunks = useRef<Blob[]>([]);

  // Function to round time to nearest 15 minutes
  const roundToNearest15Minutes = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.round(minutes / 15) * 15;
    const roundedDate = new Date(date);
    roundedDate.setMinutes(roundedMinutes, 0, 0); // Set seconds and milliseconds to 0
    
    // If rounding went to next hour, adjust
    if (roundedMinutes === 60) {
      roundedDate.setHours(roundedDate.getHours() + 1);
      roundedDate.setMinutes(0);
    }
    
    return roundedDate;
  };

  // Function to generate meeting timestamp with current date and rounded time
  const generateMeetingTimestamp = (): string => {
    const now = new Date();
    const roundedTime = roundToNearest15Minutes(now);
    return roundedTime.toISOString();
  };


  // Audio backup functions
  const startAudioBackup = async () => {
    try {
      console.log('🎯 Starting audio backup recording...');
      
      // ChatGPT recommended audio settings for backup recording 
      audioBackupStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,        // 48kHz - Chrome native standard
          channelCount: 1,
          echoCancellation: false,  // Disabled to avoid artifacts
          noiseSuppression: false,  // Disabled to avoid artifacts
          autoGainControl: false    // Disabled to avoid artifacts
        }
      });

      audioBackupChunks.current = [];
      audioBackupRecorder.current = new MediaRecorder(audioBackupStream.current, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioBackupRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioBackupChunks.current.push(event.data);
        }
      };

      audioBackupRecorder.current.start(1000); // Collect data every second
      console.log('✅ Audio backup recording started');
      
    } catch (error) {
      console.error('❌ Failed to start audio backup:', error);
    }
  };

  const stopAudioBackup = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!audioBackupRecorder.current || audioBackupRecorder.current.state === 'inactive') {
        resolve(null);
        return;
      }

      audioBackupRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioBackupChunks.current, { type: 'audio/webm' });
        console.log('✅ Audio backup recording stopped, size:', audioBlob.size);
        
        // Clean up
        if (audioBackupStream.current) {
          audioBackupStream.current.getTracks().forEach(track => track.stop());
          audioBackupStream.current = null;
        }
        
        resolve(audioBlob);
      };

      audioBackupRecorder.current.stop();
    });
  };

  // Calculate expected word count based on duration (5000 words per hour)
  const calculateExpectedWordCount = (durationSeconds: number): number => {
    const hours = durationSeconds / 3600;
    return Math.floor(hours * 5000);
  };

  // Check if audio backup is needed based on word count vs duration
  const shouldCreateAudioBackup = (wordCount: number, durationSeconds: number): boolean => {
    const expectedWords = calculateExpectedWordCount(durationSeconds);
    const wordCountRatio = wordCount / expectedWords;
    const needsBackup = wordCountRatio < 0.7; // If word count is less than 70% of expected
    
    console.log(`📊 Word count analysis:`, {
      actualWords: wordCount,
      expectedWords,
      ratio: wordCountRatio,
      needsBackup
    });
    
    return needsBackup && durationSeconds > 300; // Only for meetings longer than 5 minutes
  };

  // Upload audio backup to Supabase storage
  const uploadAudioBackup = async (audioBlob: Blob, meetingId: string, duration: number, wordCount: number, expectedWords: number): Promise<string | null> => {
    try {
      console.log('📤 Uploading audio backup...');
      
      const fileName = `${user?.id}/${meetingId}_backup.webm`;
      
      const { data, error } = await supabase.storage
        .from('meeting-audio-backups')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Calculate quality score based on word count vs expected
      const qualityScore = Math.min(wordCount / expectedWords, 1.0);
      
      // Store backup metadata
      const { error: metadataError } = await supabase
        .from('meeting_audio_backups')
        .insert({
          meeting_id: meetingId,
          user_id: user?.id,
          file_path: data.path,
          file_size: audioBlob.size,
          duration_seconds: duration,
          transcription_quality_score: qualityScore,
          word_count: wordCount,
          expected_word_count: expectedWords,
          backup_reason: qualityScore < 0.7 ? 'low_word_count' : 'quality_check'
        });

      if (metadataError) {
        console.error('❌ Failed to store backup metadata:', metadataError);
      }

      console.log('✅ Audio backup uploaded successfully:', data.path);
      return data.path;
      
    } catch (error) {
      console.error('❌ Failed to upload audio backup:', error);
      return null;
    }
  };

  // 5-second chunking with 2-second overlap functions
  const startOverlappingChunks = async (meetingId: string) => {
    try {
      console.log('🎵 Starting 5-second overlapping chunks with Profile 1 settings...');
      
      // ChatGPT recommended: standardize to 48kHz end-to-end  
      const profile1Constraints: MediaStreamConstraints = {
        audio: {
          sampleRate: 48000,        // 48kHz - Chrome native, avoid resampling artifacts
          channelCount: 1,
          echoCancellation: false,  // Disabled - can create artifacts in meetings
          noiseSuppression: false,  // Disabled - can create artifacts in meetings
          autoGainControl: false    // Disabled - can create artifacts in meetings
        }
      };

      console.log('🎵 Profile 1 audio constraints:', profile1Constraints);
      
      // Get SEPARATE microphone stream for overlapping chunks (not shared with preview)
      const chunksStream = await navigator.mediaDevices.getUserMedia(profile1Constraints);
      
      // Add audio level monitoring with ChatGPT recommended sample rate
      const audioContext = new AudioContext({ sampleRate: 48000 });
      const source = audioContext.createMediaStreamSource(chunksStream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silentCounters = 0;
      
      const checkAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        console.log(`🎵 Audio level: ${average.toFixed(2)}`);
        
        if (average < 5) { // Very low threshold
          silentCounters++;
          console.log(`⚠️ Low audio detected (${silentCounters}/3)`);
          
          if (silentCounters >= 3) {
            console.log('🔄 Audio stream appears silent, this might indicate a browser audio issue');
            toast.warning("Low audio detected - check microphone settings or browser permissions");
          }
        } else {
          silentCounters = 0; // Reset counter on good audio
        }
      };
      
      // Monitor audio levels every second
      const levelInterval = setInterval(checkAudioLevel, 1000);
      
      console.log('🎵 Successfully got INDEPENDENT audio stream for chunks:', {
        tracks: chunksStream.getAudioTracks().length,
        trackSettings: chunksStream.getAudioTracks()[0]?.getSettings(),
        audioContext: audioContext.state
      });

      let chunkId = 0;
      
      const startNewChunk = () => {
        const currentChunkId = chunkId++;
        const chunks: Blob[] = [];
        chunkData.current.set(currentChunkId, chunks);
        chunkStartTimes.current.set(currentChunkId, new Date());

        // Create new recorder for this chunk using the SAME stream
        const recorder = new MediaRecorder(chunksStream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        console.log(`🎵 Created recorder for chunk ${currentChunkId} using shared chunks stream`);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onstop = async () => {
          await processChunk(meetingId, currentChunkId);
        };

        chunkRecorders.current.set(currentChunkId, recorder);
        recorder.start(); // Use default timeslice for more stable recording

        console.log(`🎵 Started chunk ${currentChunkId}`);

        // Stop this chunk after 5 seconds
        const stopTimeout = setTimeout(() => {
          if (chunkRecorders.current.has(currentChunkId)) {
            const recorder = chunkRecorders.current.get(currentChunkId);
            if (recorder && recorder.state === 'recording') {
              recorder.stop();
              chunkRecorders.current.delete(currentChunkId);
            }
          }
        }, 5000);

        chunkIntervals.current.set(currentChunkId, stopTimeout);
      };

      // Start first chunk immediately
      startNewChunk();

      // Start new chunks every 3 seconds (5 second chunks with 2 second overlap)
      const chunkInterval = setInterval(() => {
        // More robust check for recording state
        if (isRecording && isRecordingRef.current && chunksStream && chunksStream.active) {
          console.log(`🔄 Starting new chunk ${chunkId + 1} - system is active`);
          addDebugLog(`🔄 Starting chunk ${chunkId + 1}`);
          startNewChunk();
          
          // Force UI update to show transcription is active
          toast.info(`Recording chunk ${chunkId + 1}`, {
            description: `Continuous transcription active`,
            duration: 1500
          });
        } else {
          console.log(`🛑 Stopping chunk interval - recording state:`, {
            isRecording,
            isRecordingRef: isRecordingRef.current,
            streamActive: chunksStream?.active
          });
          addDebugLog('🛑 Stopping chunks - recording ended');
          clearInterval(chunkInterval);
          
          // Clean up audio monitoring
          if (levelInterval) {
            clearInterval(levelInterval);
          }
          // Clean up the chunks stream when recording stops
          if (chunksStream) {
            chunksStream.getTracks().forEach(track => track.stop());
          }
          // Clean up audio context
          if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
          }
        }
      }, 3000); // 3 seconds = 5 second chunk - 2 second overlap

      // Add a heartbeat to show recording is active every 5 seconds
      const heartbeatInterval = setInterval(() => {
        if (isRecording && isRecordingRef.current) {
          addDebugLog(`💓 Recording active - chunk ${chunkId}`);
          
          // Get current transcript length for user feedback
          const currentLength = transcript.length;
          const currentWords = wordCount;
          
          // More frequent visual feedback
          toast.info(`🎙️ Recording`, {
            description: `${currentWords} words • ${Math.floor(currentLength/100)} paragraphs`,
            duration: 2000
          });
          
          console.log(`💓 Heartbeat: ${currentWords} words, ${currentLength} chars transcribed`);
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 5000); // Every 5 seconds for frequent feedback

      segmentIntervalRef.current = chunkInterval;

      console.log('✅ Overlapping chunk recording started with independent stream');
      
    } catch (error) {
      console.error('❌ Failed to start overlapping chunk recording:', error);
    }
  };

  const processChunk = async (meetingId: string, chunkId: number) => {
    try {
      const chunks = chunkData.current.get(chunkId);
      const startTime = chunkStartTimes.current.get(chunkId);
      
      if (!chunks || chunks.length === 0 || !startTime) {
        console.log(`⚠️ No data for chunk ${chunkId}`);
        addDebugLog(`⚠️ Chunk ${chunkId}: no data`);
        return;
      }

      console.log(`🎵 Processing chunk ${chunkId} (${chunks.length} audio chunks, total size: ${chunks.reduce((sum, chunk) => sum + chunk.size, 0)} bytes)...`);
      addDebugLog(`🎵 Processing chunk ${chunkId}...`);
      
      // Create blob from chunks
      const chunkBlob = new Blob(chunks, { type: 'audio/webm' });
      const endTime = new Date();
      
      // Add timeout for the transcription request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`⏰ Chunk ${chunkId} transcription timed out after 30 seconds`);
        addDebugLog(`⏰ Chunk ${chunkId}: timeout`);
      }, 30000); // 30 second timeout

      try {
        // Send to transcription service with timeout
        const response = await fetch('https://dphcnbricafkbtizkoal.functions.supabase.co/functions/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwaGNuYnJpY2Fma2J0aXprb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3MzIyMzIsImV4cCI6MjA2ODMwODIzMn0.U3bJI6P1yzgRBz_k2s0zlJGu1GWiVRTHjYgv9QQggPs`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            audio: await convertBlobToBase64(chunkBlob)
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Transcription failed for chunk ${chunkId}:`, response.status, errorText);
          addDebugLog(`❌ Chunk ${chunkId}: ${response.status}`);
          return;
        }

        const data = await response.json();

        // Process transcription result
        const transcriptionText = data.text || '';
        const confidence = data.confidence || 0;
        
        console.log(`✅ Chunk ${chunkId} transcribed:`, {
          text: transcriptionText.substring(0, 50) + '...',
          confidence,
          duration: Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        });

        // Add to transcript with timestamp and overlap handling
        if (transcriptionText.trim() && transcriptionText.length > 3) {
          addDebugLog(`📝 Chunk ${chunkId}: "${transcriptionText.substring(0, 30)}..." (${Math.round(confidence * 100)}%)`);
          
          const chunkTimestamp = new Date(startTime.getTime()).toLocaleTimeString();
          
          // Update the main transcript with immediate state update
          setTranscript(prev => {
            const newTranscript = prev + (prev ? ' ' : '') + transcriptionText;
            console.log(`📝 Transcript updated: ${newTranscript.length} chars, chunk ${chunkId}`);
            onTranscriptUpdate(newTranscript);
            return newTranscript;
          });

          // Update word count with immediate feedback
          const words = transcriptionText.split(/\s+/).filter(word => word.length > 0);
          setWordCount(prev => {
            const newCount = prev + words.length;
            console.log(`📊 Word count updated: ${newCount} words (+${words.length})`);
            onWordCountUpdate(newCount);
            return newCount;
          });

          // Create transcript data for live display
          const transcriptData: TranscriptData = {
            text: transcriptionText,
            speaker: `Speaker ${speakerCount + 1}`,
            confidence: confidence,
            timestamp: new Date().toISOString(),
            isFinal: true
          };

          // Update realtime transcripts with forced re-render
          setRealtimeTranscripts(prev => {
            const updated = [...prev.slice(-19), transcriptData]; // Keep last 20
            console.log(`🔄 Real-time transcripts updated: ${updated.length} items`);
            return updated;
          });

          // Show user feedback for EVERY chunk to ensure visibility
          toast.success(`New transcription`, {
            description: `"${transcriptionText.substring(0, 50)}${transcriptionText.length > 50 ? '...' : ''}"`,
            duration: 2000
          });
          
          console.log(`✅ Chunk ${chunkId} processed and UI updated successfully`);
        } else {
          console.log(`⏭️ Chunk ${chunkId} was silent or unclear`);
          addDebugLog(`⏭️ Chunk ${chunkId}: silent/unclear`);
        }

      } catch (transcriptionError) {
        clearTimeout(timeoutId);
        if (transcriptionError.name === 'AbortError') {
          console.log(`⏰ Chunk ${chunkId} transcription was aborted due to timeout`);
          addDebugLog(`⏰ Chunk ${chunkId}: aborted`);
        } else {
          console.error(`❌ Transcription error for chunk ${chunkId}:`, transcriptionError);
          addDebugLog(`❌ Chunk ${chunkId}: ${transcriptionError.message}`);
        }
      }

      // Clean up chunk data
      chunkData.current.delete(chunkId);
      chunkStartTimes.current.delete(chunkId);

    } catch (error) {
      console.error(`💥 Error processing chunk ${chunkId}:`, error);
      addDebugLog(`💥 Chunk ${chunkId}: processing error`);
    }
  };

  // Helper function to convert blob to base64
  const convertBlobToBase64 = async (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const stopOverlappingChunks = async () => {
    try {
      console.log('🛑 Stopping overlapping chunk recording...');
      
      // Clear the main interval
      if (segmentIntervalRef.current) {
        clearInterval(segmentIntervalRef.current);
        segmentIntervalRef.current = null;
      }

      // Stop all active recorders
      for (const [chunkId, recorder] of chunkRecorders.current.entries()) {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      }

      // Clear all timeouts
      for (const [chunkId, timeout] of chunkIntervals.current.entries()) {
        clearTimeout(timeout);
      }

      // Clean up maps
      chunkRecorders.current.clear();
      chunkIntervals.current.clear();
      
      console.log('✅ Overlapping chunk recording stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop overlapping chunk recording:', error);
    }
  };

  // Audio segment recording functions (legacy - keeping for compatibility)
  const startAudioSegmentRecording = async (meetingId: string) => {
    try {
      console.log('🎵 Starting audio segment recording...');
      
      // Get microphone stream for segment recording using Profile 1 settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      audioSegmentChunks.current = [];
      audioSegmentRecorder.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioSegmentRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioSegmentChunks.current.push(event.data);
        }
      };

      audioSegmentRecorder.current.start(1000); // Collect data every second
      segmentStartTime.current = new Date();
      currentSegmentNumber.current = 1;
      
      // Set up 10-minute interval to save segments
      segmentIntervalRef.current = setInterval(() => {
        saveCurrentSegment(meetingId);
      }, 10 * 60 * 1000); // 10 minutes

      console.log('✅ Audio segment recording started');
      
    } catch (error) {
      console.error('❌ Failed to start audio segment recording:', error);
    }
  };

  const saveCurrentSegment = async (meetingId: string) => {
    try {
      if (!audioSegmentRecorder.current || audioSegmentChunks.current.length === 0) {
        return;
      }

      console.log(`🎵 Saving audio segment ${currentSegmentNumber.current}...`);
      
      // Create blob from current chunks
      const segmentBlob = new Blob(audioSegmentChunks.current, { type: 'audio/webm' });
      const segmentEndTime = new Date();
      
      // Upload segment to storage
      const fileName = `${user?.id}/${meetingId}_segment_${currentSegmentNumber.current}.webm`;
      
      const { data: storageData, error: storageError } = await supabase.storage
        .from('meeting-audio-segments')
        .upload(fileName, segmentBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (storageError) {
        throw storageError;
      }

      // Save segment metadata to database
      const { error: dbError } = await supabase
        .from('meeting_audio_segments' as any)
        .insert({
          meeting_id: meetingId,
          segment_number: currentSegmentNumber.current,
          start_time: segmentStartTime.current.toISOString(),
          end_time: segmentEndTime.toISOString(),
          file_path: storageData.path,
          file_size: segmentBlob.size,
          duration_seconds: Math.floor((segmentEndTime.getTime() - segmentStartTime.current.getTime()) / 1000)
        } as any);

      if (dbError) {
        throw dbError;
      }

      console.log(`✅ Audio segment ${currentSegmentNumber.current} saved successfully`);
      
      // Reset for next segment
      audioSegmentChunks.current = [];
      currentSegmentNumber.current++;
      segmentStartTime.current = new Date();
      
    } catch (error) {
      console.error('❌ Failed to save audio segment:', error);
    }
  };

  const stopAudioSegmentRecording = async (meetingId: string) => {
    try {
      console.log('🛑 Stopping audio segment recording...');
      
      // Clear interval
      if (segmentIntervalRef.current) {
        clearInterval(segmentIntervalRef.current);
        segmentIntervalRef.current = null;
      }

      // Save final partial segment if there's any data
      if (audioSegmentChunks.current.length > 0) {
        await saveCurrentSegment(meetingId);
      }

      // Stop recorder
      if (audioSegmentRecorder.current && audioSegmentRecorder.current.state !== 'inactive') {
        audioSegmentRecorder.current.stop();
        audioSegmentRecorder.current.stream?.getTracks().forEach(track => track.stop());
      }

      audioSegmentRecorder.current = null;
      audioSegmentChunks.current = [];
      
      console.log('✅ Audio segment recording stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop audio segment recording:', error);
    }
  };
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Browser compatibility check
  const checkBrowserSupport = () => {
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const hasDisplayMedia = navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia;
    const hasUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    
    return {
      isSupported: hasDisplayMedia && hasUserMedia && hasMediaRecorder,
      isRecommendedBrowser: isChrome || isEdge || isFirefox,
      browserName: isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Unknown',
      isSafari,
      isIOS,
      isMobile
    };
  };
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const browserTranscriberRef = useRef<BrowserSpeechTranscriber | null>(null);
  const iPhoneTranscriberRef = useRef<iPhoneWhisperTranscriber | null>(null);
  const desktopTranscriberRef = useRef<DesktopWhisperTranscriber | null>(null);
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
        startedBy: user?.email || 'Unknown User',
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

  // Initialize transcript handler
  useEffect(() => {
    transcriptHandler.current = new IncrementalTranscriptHandler(
      (fullTranscript: string) => {
        // Update main transcript state
        setTranscript(fullTranscript);
        onTranscriptUpdate(fullTranscript);
        latestCompleteTranscriptRef.current = fullTranscript;
        
        // Update word count
        const words = fullTranscript.split(' ').filter(word => word.length > 0);
        setWordCount(words.length);
        onWordCountUpdate(words.length);
        
        // Extract last phrase (max 6 words)
        const lastSixWords = words.slice(-6).join(' ');
        setLastPhrase(lastSixWords);
        
        console.log('📝 Transcript updated:', fullTranscript.length, 'chars');
      },
      (interimText: string) => {
        // Handle interim updates for ticker
        if (interimText.trim() && tickerEnabled) {
          const truncatedText = interimText.length > 100 
            ? interimText.substring(0, 100) + "..." 
            : interimText;
          
          setTickerText(truncatedText);
          setShowTicker(true);
          
          // Auto-hide ticker after 3 seconds
          setTimeout(() => {
            setShowTicker(false);
          }, 3000);
        }
      }
    );
  }, [onTranscriptUpdate, onWordCountUpdate, tickerEnabled]);

  const handleTranscript = (transcriptData: TranscriptData) => {
    // Convert to incremental transcript format
    const incrementalData: IncrementalTranscriptData = {
      text: transcriptData.text,
      is_final: transcriptData.isFinal,
      confidence: transcriptData.confidence,
      timestamp: transcriptData.timestamp,
      speaker: transcriptData.speaker,
      segment_id: `${transcriptData.speaker}_${transcriptData.timestamp}_${Date.now()}`
    };

    // Process through incremental handler
    if (transcriptHandler.current) {
      transcriptHandler.current.processTranscript(incrementalData);
    }

    // Progressive pre-summaries: ingest transcript chunks for long sessions
    if (transcriptData.isFinal) {
      const shouldIngest = duration >= 1200 || wordCount >= 4000; // 20 min or ~4000 words
      const text = (transcriptData.text || '').trim();
      if (shouldIngest && text.length >= 120) {
        const key = text.toLowerCase().slice(0, 160);
        if (!ingestedKeysRef.current.has(key)) {
          ingestedKeysRef.current.add(key);

          let sessionId = sessionStorage.getItem('currentSessionId') || '';
          if (!sessionId && desktopTranscriberRef.current) {
            try {
              sessionId = desktopTranscriberRef.current.getSessionId();
            } catch {}
          }
          const meetingId = sessionId || null; // Use session as temp meeting link

          if (sessionId) {
            void supabase.functions.invoke('ingest-transcript-chunk', {
              body: {
                sessionId,
                meetingId,
                text,
                detailLevel: 'standard',
              }
            }).then(({ data, error }) => {
              if (error) {
                console.warn('ingest-transcript-chunk error:', error);
              } else {
                console.log('✅ Ingested summary chunk', data?.chunkIndex);
              }
            }).catch((e) => console.warn('ingest-transcript-chunk failed:', e));
          }
        }
      }
    }

    // Update transcripts array for display
    setRealtimeTranscripts(prev => {
      // Only keep recent transcripts for display (last 50 segments)
      const maxSegments = 50;
      const filtered = prev.filter(t => 
        !(t.speaker === transcriptData.speaker && !t.isFinal)
      );
      
      const newTranscripts = [...filtered, transcriptData];
      
      // Keep only the most recent segments
      const trimmed = newTranscripts.slice(-maxSegments);
      
      // Calculate speaker count
      const speakers = new Set(trimmed.map(t => t.speaker));
      setSpeakerCount(speakers.size);
      
      console.log('🔍 Adding transcript:', transcriptData.isFinal ? 'FINAL' : 'interim', `(${transcriptData.text.length} chars)`);
      
      return trimmed;
    });
  };
  const handleBrowserTranscript = (data: BrowserTranscriptData) => {
    // Skip empty transcripts
    if (!data.text || !data.text.trim()) return;
    
    const transcriptData: TranscriptData = {
      text: data.text.trim(),
      speaker: data.speaker || 'Speaker',
      confidence: data.confidence || 0.9,
      timestamp: new Date().toISOString(),
      isFinal: data.is_final
    };
    
    addDebugLog(`🎙️ ${data.is_final ? 'Final' : 'Interim'}: "${data.text.substring(0, 50)}..." (${Math.round((data.confidence || 0.9) * 100)}%)`);
    setTestTranscripts(prev => [...prev.slice(-9), data.text]);
    
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

  // iPhone-optimized transcription using Whisper AI
  const startIPhoneWhisperTranscription = async () => {
    try {
      console.log('📱 Creating iPhone Whisper transcriber instance...');
      addDebugLog('📱 Starting iPhone Whisper transcription...');
      iPhoneTranscriberRef.current = new iPhoneWhisperTranscriber(
        handleBrowserTranscript, // Same handler works for both
        handleTranscriptionError,
        handleStatusChange
      );
      
      console.log('📱 Starting transcription...');
      await iPhoneTranscriberRef.current.startTranscription();
      console.log('✅ iPhone Whisper transcription started successfully');
      addDebugLog('✅ iPhone Whisper transcription started');
    } catch (error) {
      console.error('❌ iPhone Whisper transcription error:', error);
      addDebugLog(`❌ Failed to start iPhone transcription: ${error}`);
      console.error('Failed to start iPhone transcription:', error);
      throw error;
    }
  };

  // Desktop Whisper transcription for better accuracy
  const startDesktopWhisperTranscription = async () => {
    addDebugLog('🖥️ Starting Desktop Whisper transcription...');
    
    const transcriber = new DesktopWhisperTranscriber(
      handleBrowserTranscript,
      handleTranscriptionError,
      handleStatusChange
    );

    await transcriber.startTranscription();
    desktopTranscriberRef.current = transcriber;
    
    addDebugLog('✅ Microphone speech recognition started successfully');
    console.log('Recording started with microphone speech recognition');
  };

  // Smart transcription method that chooses the best option for the device
  const startMicrophoneTranscription = async () => {
    const browserSupport = checkBrowserSupport();
    
    // Debug: Log browser detection results
    console.log('🔍 Browser detection results:', {
      isIOS: browserSupport.isIOS,
      isSafari: browserSupport.isSafari,
      isMobile: browserSupport.isMobile,
      browserName: browserSupport.browserName,
      userAgent: navigator.userAgent
    });
    addDebugLog(`🔍 Detected browser: ${browserSupport.browserName} (iOS: ${browserSupport.isIOS})`);
    
    if (browserSupport.isIOS) {
      // Use iPhone Whisper transcription for iOS devices
      console.log('📱 Attempting iPhone Whisper transcription...');
      addDebugLog('📱 Attempting iPhone Whisper transcription for iOS device...');
      try {
        await startIPhoneWhisperTranscription();
        console.log('✅ iPhone Whisper transcription started successfully');
        addDebugLog('✅ iPhone Whisper transcription started successfully');
      } catch (error) {
        console.error('❌ iPhone Whisper transcription failed:', error);
        addDebugLog(`❌ iPhone Whisper transcription failed: ${error.message}`);
        addDebugLog('🔄 Falling back to browser speech recognition...');
        toast.info('iPhone transcription failed. Falling back to browser speech recognition.');
        
        // Fallback to desktop Whisper transcription
        await startDesktopWhisperTranscription();
      }
    } else {
      // Use desktop Whisper transcription for better accuracy
      console.log('🖥️ Using Desktop Whisper transcription for desktop/non-iOS device');
      addDebugLog('🖥️ Using Desktop Whisper transcription for desktop/non-iOS device');
      await startDesktopWhisperTranscription();
    }
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
        addDebugLog('🎤 Using WASAPI Desktop Audio for system capture...');
        
        // Use WASAPI Desktop Audio method that works
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            sampleRate: 48000,
            channelCount: 2,
            // Windows-specific WASAPI hints for desktop audio
            latency: 0.01,
            deviceId: 'communications'
          } as any
        });
        
        addDebugLog('✅ WASAPI Desktop Audio access granted for system capture');
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
        addDebugLog('💡 Using WASAPI Desktop Audio processing - capturing real system audio');
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

  const startTestMode = async () => {
    addDebugLog('🎤 Starting advanced dual audio capture (system + microphone)...');
    
    try {
      // Check browser support first
      console.log('Browser check:', {
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
        hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        userAgent: navigator.userAgent
      });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Your browser does not support screen capture. Please use Chrome, Edge, or Firefox.');
      }

      // Step 1: Try getting display media with different approaches
      addDebugLog('📺 Requesting screen capture with audio...');
      let displayStream;
      
      try {
        // First try: audio-only capture (preferred)
        console.log('Attempting audio-only screen capture...');
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: true
        });
        addDebugLog('✅ Audio-only screen capture successful');
      } catch (audioOnlyError) {
        console.log('Audio-only failed:', audioOnlyError.message);
        addDebugLog('⚠️ Audio-only failed, trying video+audio approach...');
        
        try {
          // Second try: video+audio, then extract audio
          console.log('Attempting video+audio screen capture...');
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
          });
          
          // Remove video tracks, keep only audio
          const videoTracks = displayStream.getVideoTracks();
          videoTracks.forEach(track => {
            track.stop();
            displayStream.removeTrack(track);
          });
          addDebugLog('✅ Video+audio capture successful, video tracks removed');
        } catch (videoAudioError) {
          console.log('Video+audio failed:', videoAudioError.message);
          throw new Error(`Screen capture not supported: ${videoAudioError.message}`);
        }
      }

      // Check if we got audio tracks
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found in screen capture. Please ensure you share a tab/window with audio.');
      }
      
      console.log('Display stream audio tracks:', audioTracks.length);
      addDebugLog(`📺 Got ${audioTracks.length} audio track(s) from screen capture`);
      // Step 2: Get microphone audio with simpler constraints
      addDebugLog('🎤 Requesting microphone access...');
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true // Use simple constraints for better compatibility
      });
      
      const micAudioTracks = micStream.getAudioTracks();
      console.log('Microphone audio tracks:', micAudioTracks.length);
      addDebugLog(`🎤 Got ${micAudioTracks.length} microphone track(s)`);

      // Step 3: Combine both streams and add audio level monitoring
      addDebugLog('🔀 Combining audio streams...');
      const combinedStream = new MediaStream([
        ...displayStream.getAudioTracks(),
        ...micStream.getAudioTracks()
      ]);
      
      console.log('Combined stream tracks:', combinedStream.getTracks().length);
      addDebugLog(`🔀 Combined stream has ${combinedStream.getTracks().length} total tracks`);
      
      // Add audio level monitoring to check if we're getting audio
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(combinedStream);
      source.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Monitor audio levels
      const monitorAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        
        if (average > 5) { // If there's some audio activity
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

      // Step 4: Set up MediaRecorder with iOS/mobile-optimized settings
      const browserSupport = checkBrowserSupport();
      let mimeType = 'audio/webm';
      let bitrate = 128000;
      
      // iOS/Safari optimization - prefer formats that work better on mobile
      if (browserSupport.isIOS || browserSupport.isSafari) {
        // iOS Safari prefers mp4 format
        const iosFormats = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac'];
        for (const format of iosFormats) {
          if (MediaRecorder.isTypeSupported(format)) {
            mimeType = format;
            addDebugLog(`📱 iOS optimized format: ${format}`);
            break;
          }
        }
      } else {
        // Standard desktop browser formats
        const standardFormats = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
        for (const format of standardFormats) {
          if (MediaRecorder.isTypeSupported(format)) {
            mimeType = format;
            break;
          }
        }
      }
      
      // Fallback to default if nothing is supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = '';
        bitrate = undefined;
        addDebugLog('⚠️ Using browser default audio format');
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
      isRecordingRef.current = false;
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
        speaker: 'Speaker'
      });

    } catch (error) {
      addDebugLog(`❌ Transcription failed: ${error.message}`);
    }
  };

  const startTestRecording = async () => {
    try {
      addDebugLog('🚀 Starting test recording with microphone...');
      console.log('Starting test recording with microphone...');
      
      // Clear previous debug logs and test transcripts
      setDebugLog([]);
      setTestTranscripts([]);
      
      // Always use microphone transcription
      await startMicrophoneTranscription();
      
    setIsRecording(true);
    isRecordingRef.current = true;
      setRealtimeTranscripts([]);
      setSpeakerCount(1);
      setStartTime(generateMeetingTimestamp());
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

      const successMessage = 'Test recording started with microphone!';
      toast.success(successMessage);
    } catch (error: any) {
      console.error('Failed to start test recording:', error);
      addDebugLog(`❌ Failed to start test: ${error.message}`);
      toast.error(error.message || 'Failed to start test recording');
      setIsRecording(false);
      isRecordingRef.current = false;
      setConnectionStatus("Error");
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
      
      if (iPhoneTranscriberRef.current) {
        iPhoneTranscriberRef.current.stopTranscription();
      }
      
      if (desktopTranscriberRef.current) {
        desktopTranscriberRef.current.stopTranscription();
      }
      
      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      setConnectionStatus("Disconnected");
      addDebugLog('✅ Test recording stopped');
      toast.success('Test recording stopped successfully');
      
    } catch (error: any) {
      console.error('Failed to stop test recording:', error);
      addDebugLog(`❌ Failed to stop test: ${error.message}`);
      toast.error('Failed to stop test recording');
    }
  };

  // Start transcript snippet monitoring
  const startTranscriptSnippetMonitoring = () => {
    if (transcriptSnippetIntervalRef.current) {
      clearInterval(transcriptSnippetIntervalRef.current);
    }
    
    transcriptSnippetIntervalRef.current = setInterval(() => {
      // Get the last 5 seconds worth of transcript from the accumulated transcript
      const words = latestCompleteTranscriptRef.current.split(' ');
      const recentWords = words.slice(-50); // Approximate last 5 seconds (10 words per second avg)
      const snippet = recentWords.join(' ');
      
      if (snippet.trim().length > 0) {
        setTranscriptSnippet(snippet);
        setShowTranscriptSnippet(true);
        console.log('📝 Transcript snippet (last 5s):', snippet);
        
        // Hide the snippet after 3 seconds
        setTimeout(() => {
          setShowTranscriptSnippet(false);
        }, 3000);
      }
    }, 5000); // Every 5 seconds
  };

  const startStereoRecording = async () => {
    try {
      console.log('🎧 Starting stereo recording (Left=Mic, Right=System)...');
      
      // Start stereo capture
      const stereoStream = await stereoAudioCapture.current.startCapture();
      
      // Initialize stereo recorder
      stereoChunks.current = [];
      stereoRecorder.current = new MediaRecorder(stereoStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      stereoRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          stereoChunks.current.push(event.data);
        }
      };

      stereoRecorder.current.start(1000); // Collect data every second
      console.log('✅ Stereo recording started');
      addDebugLog('✅ Stereo recording started (Left=Mic, Right=System)');
      
    } catch (error) {
      console.error('❌ Failed to start stereo recording:', error);
      addDebugLog(`❌ Stereo recording failed: ${error.message}`);
      // Fallback to regular audio backup
      await startAudioBackup();
    }
  };

  const stopStereoRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!stereoRecorder.current || stereoRecorder.current.state === 'inactive') {
        resolve(null);
        return;
      }

      stereoRecorder.current.onstop = () => {
        const stereoBlob = new Blob(stereoChunks.current, { type: 'audio/webm' });
        console.log('✅ Stereo recording stopped, size:', stereoBlob.size);
        
        // Clean up stereo capture
        if (stereoAudioCapture.current.isCapturing()) {
          stereoAudioCapture.current.stopCapture();
        }
        
        resolve(stereoBlob);
      };

      stereoRecorder.current.stop();
    });
  };

  // Create channel-specific audio from stereo recording
  const createChannelSpecificAudio = async (stereoBlob: Blob) => {
    try {
      const audioContext = new AudioContext();
      const arrayBuffer = await stereoBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      console.log('🎵 Audio analysis:', {
        numberOfChannels: audioBuffer.numberOfChannels,
        duration: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length
      });
      
      if (audioBuffer.numberOfChannels >= 2) {
        // Create mono buffers for each channel
        const micBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        const systemBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        
        // Copy left channel (mic) to micBuffer
        micBuffer.copyToChannel(audioBuffer.getChannelData(0), 0);
        
        // Copy right channel (system) to systemBuffer  
        systemBuffer.copyToChannel(audioBuffer.getChannelData(1), 0);
        
        // Convert buffers back to blobs
        const micAudioBlob = await audioBufferToBlob(micBuffer);
        const systemAudioBlob = await audioBufferToBlob(systemBuffer);
        
        // Store blobs for later use
        setMicBlob(micAudioBlob);
        setSystemBlob(systemAudioBlob);
        
        // Create URLs for playback
        setMicAudioUrl(URL.createObjectURL(micAudioBlob));
        setSystemAudioUrl(URL.createObjectURL(systemAudioBlob));
        
        console.log('✅ Created separate channel audio files', {
          micBlobSize: micAudioBlob.size,
          systemBlobSize: systemAudioBlob.size
        });
      } else {
        console.warn('⚠️ Audio only has one channel, creating duplicate for testing');
        
        // For mono audio, create two copies so user can test both channels
        // This helps with troubleshooting even when system audio isn't captured
        const monoBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        monoBuffer.copyToChannel(audioBuffer.getChannelData(0), 0);
        
        const micAudioBlob = await audioBufferToBlob(monoBuffer);
        const systemAudioBlob = await audioBufferToBlob(monoBuffer); // Same content for testing
        
        setMicBlob(micAudioBlob);
        setSystemBlob(systemAudioBlob); // Now both are populated
        
        const micUrl = URL.createObjectURL(micAudioBlob);
        const systemUrl = URL.createObjectURL(systemAudioBlob);
        setMicAudioUrl(micUrl);
        setSystemAudioUrl(systemUrl);
        
        console.log('✅ Created duplicate channel audio files for testing', {
          originalChannels: audioBuffer.numberOfChannels,
          micBlobSize: micAudioBlob.size,
          systemBlobSize: systemAudioBlob.size
        });
      }
      
      audioContext.close();
    } catch (error) {
      console.error('❌ Failed to create channel-specific audio:', error);
    }
  };

  // Helper function to convert AudioBuffer to Blob
  const audioBufferToBlob = async (audioBuffer: AudioBuffer): Promise<Blob> => {
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert to WAV format
    const wavArrayBuffer = audioBufferToWav(renderedBuffer);
    return new Blob([wavArrayBuffer], { type: 'audio/wav' });
  };

  // Convert AudioBuffer to WAV format
  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  };

  const startRecording = async () => {
    try {
      addDebugLog('🚀 Starting recording...');
      console.log('Starting recording...');
      
      // Clear previous debug logs and test transcripts
      setDebugLog([]);
      setTestTranscripts([]);
      
      // Clear transcript handler
      if (transcriptHandler.current) {
        transcriptHandler.current.clear();
      }
      
      // Check recording mode and browser
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      const isEdge = /Edg/.test(navigator.userAgent);
      const useScreenShare = isChrome || isEdge;
      
      if (recordingMode === 'mic-only') {
        // Microphone only mode
        addDebugLog('🎙️ Starting microphone-only recording...');
        await startMicrophoneTranscription();
      } else if (recordingMode === 'mic-and-system') {
        // Microphone + System audio mode
        if (useScreenShare) {
          // Chrome & Edge: Use screen share method for system audio
          const browserName = isChrome ? 'Chrome' : 'Edge';
          addDebugLog(`🖥️ ${browserName} detected - using screen share for system audio...`);
          await startComputerAudioTranscription();
        } else {
          // Other browsers: Use stereo recording
          addDebugLog('🎧 Starting stereo recording (mic + system audio)...');
          await startStereoRecording();
          await startMicrophoneTranscription();
        }
      }
      
      setIsRecording(true);
      isRecordingRef.current = true;
      setRealtimeTranscripts([]);
      setSpeakerCount(1);
      setStartTime(generateMeetingTimestamp());
      setConnectionStatus("Connected");
      
      // Generate and store temporary meeting ID for this session
      const tempMeetingId = crypto.randomUUID();
      sessionStorage.setItem('currentSessionId', tempMeetingId); // Store for later retrieval
      if (desktopTranscriberRef.current) {
        desktopTranscriberRef.current.setMeetingId(tempMeetingId);
        console.log(`🔗 Set temporary meeting ID: ${tempMeetingId}`);
      }

      // Start overlapping chunk recording for system audio (only if not microphone-only and not using screen share)
      if (recordingMode === 'mic-and-system' && !useScreenShare) {
        await startOverlappingChunks(tempMeetingId);
      }
      
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

      // Start transcript snippet monitoring
      startTranscriptSnippetMonitoring();

      const modeText = recordingMode === 'mic-only' ? 'microphone only' : 
                      useScreenShare ? `microphone + screen audio (${isChrome ? 'Chrome' : 'Edge'})` : 'microphone + system audio';
      const successMessage = `Recording started with ${modeText}!`;
      toast.success(successMessage);
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      addDebugLog(`❌ Failed to start: ${error.message}`);
      
      // Provide specific error messages for screen share browsers
      const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
      const isEdge = /Edg/.test(navigator.userAgent);
      const useScreenShare = isChrome || isEdge;
      
      if (useScreenShare && recordingMode === 'mic-and-system') {
        const browserName = isChrome ? 'Chrome' : 'Edge';
        toast.error(`Please allow screen sharing permission in ${browserName} to capture meeting audio. Try again and select a window/tab to share.`);
      } else {
        toast.error(error.message || 'Failed to start recording');
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      setConnectionStatus("Error");
    }
  };

  const stopRecording = async () => {
    setIsStoppingRecording(true);
    addDebugLog('🛑 Stopping recording...');
    console.log('Stopping recording...');
    
    // Stop duration timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Stop transcript snippet monitoring
    if (transcriptSnippetIntervalRef.current) {
      clearInterval(transcriptSnippetIntervalRef.current);
      transcriptSnippetIntervalRef.current = null;
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
    
    // Stop iPhone transcriber
    if (iPhoneTranscriberRef.current) {
      iPhoneTranscriberRef.current.stopTranscription();
      iPhoneTranscriberRef.current = null;
    }
    
    // Stop desktop transcriber and wait for final processing
    if (desktopTranscriberRef.current) {
      await desktopTranscriberRef.current.stopTranscription();
      // Give extra time for final transcription to be processed and combined
      await new Promise(resolve => setTimeout(resolve, 3000));
      desktopTranscriberRef.current = null;
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
    
    // Stop overlapping chunk recording
    await stopOverlappingChunks();
    
    // Stop stereo recording
    const stereoBlob = await stopStereoRecording();
    
    // Create audio URL for playback from the recorded stereo audio
    if (stereoBlob && stereoBlob.size > 0) {
      const audioUrl = URL.createObjectURL(stereoBlob);
      setRecordingAudioUrl(audioUrl);
      setRecordingBlob(stereoBlob); // Store the actual blob
      
      // Create separate URLs for each channel and wait for completion
      await createChannelSpecificAudio(stereoBlob);
      
      console.log('✅ Stereo recording audio ready for playback:', {
        size: stereoBlob.size,
        url: audioUrl,
        channels: 'Left=Mic, Right=System'
      });
    } else {
      console.warn('⚠️ No stereo recording available - no audio will be saved');
      setRecordingAudioUrl(null);
      setRecordingBlob(null);
    }
    
      setIsRecording(false);
      isRecordingRef.current = false;
    setIsStoppingRecording(false);
    setConnectionStatus("Disconnected");
    
    // Clear unsaved meeting data when stopping normally
    localStorage.removeItem('unsaved_meeting');
    
    console.log('Recording stopped');
    toast.success('Recording stopped');
    
    // Check if recording has at least 10 seconds of content
    if (duration < 10) {
      toast.error('Recording too short. Minimum 10 seconds required.');
      return;
    }

    // Check if there's meaningful transcript content (at least 20 words)
    if (wordCount < 20) {
      toast.error('Recording too short. Minimum 20 words required.');
      return;
    }
    
    // Check if audio backup is needed based on word count vs duration
    const needsAudioBackup = shouldCreateAudioBackup(wordCount, duration);
    console.log(`📊 Audio backup needed: ${needsAudioBackup}`);
    
    // STOP all real-time processing immediately to prevent interference
    setRealtimeTranscripts([]); // Clear any pending real-time transcripts
    
    // Get transcript directly from the database instead of relying on state
    console.log('🔍 DEBUG: Getting transcript from database...');
    let finalTranscript = '';
    
    // Get session ID from storage (reliable even if transcriber is cleaned up)
    let sessionId = sessionStorage.getItem('currentSessionId') || '';
    console.log(`🔍 DEBUG: Session ID from storage: "${sessionId}"`);
    
    // Also try to get from transcriber if available
    if (desktopTranscriberRef.current) {
      const transcriberSessionId = desktopTranscriberRef.current.getSessionId();
      console.log(`🔍 DEBUG: Session ID from transcriber: "${transcriberSessionId}"`);
      if (transcriberSessionId) {
        sessionId = transcriberSessionId;
        console.log(`🔍 DEBUG: Using transcriber session ID: "${sessionId}"`);
      }
      
      // Try transcriber method first - this should give us the complete database transcript
      finalTranscript = await desktopTranscriberRef.current.getCompleteTranscriptFromDatabase();
      console.log(`🔍 DEBUG: Database transcript from transcriber: ${finalTranscript.length} chars`);
      if (finalTranscript) {
        console.log(`🔍 DEBUG: Database transcript preview: "${finalTranscript.substring(0, 200)}..."`);
        console.log(`🔍 DEBUG: Database transcript ending: "${finalTranscript.slice(-200)}"`);
      }
    }
    
    // If transcriber didn't return transcript, query database directly with session ID
    if (!finalTranscript && sessionId) {
      try {
        console.log(`🔍 DEBUG: Querying database directly for session: ${sessionId}`);
        const { data, error } = await supabase
          .from('meeting_transcription_chunks')
          .select('transcription_text, chunk_number')
          .eq('session_id', sessionId)
          .order('chunk_number');

        if (!error && data && data.length > 0) {
          finalTranscript = data.map(chunk => chunk.transcription_text).join(' ').trim();
          console.log(`🔍 DEBUG: Database transcript direct query: ${finalTranscript.length} chars, ${data.length} chunks`);
          console.log(`🔍 DEBUG: Chunk details:`, data.map(chunk => `Chunk ${chunk.chunk_number}: ${chunk.transcription_text.substring(0, 50)}...`));
          console.log(`🔍 DEBUG: Direct query preview: "${finalTranscript.substring(0, 200)}..."`);
          console.log(`🔍 DEBUG: Direct query ending: "${finalTranscript.slice(-200)}"`);
        } else {
          console.log('🔍 DEBUG: No chunks found in database for session:', sessionId, 'Error:', error);
          console.log('🔍 DEBUG: Query data result:', data);
        }
      } catch (dbError) {
        console.error('❌ Direct database query failed:', dbError);
      }
    }
    
    // If database methods failed, fall back to combining in-memory final transcripts
    // but use the most recent complete transcript only
    if (!finalTranscript) {
      console.log('🔍 DEBUG: No database transcript available, using in-memory transcripts');
      const finalTranscripts = realtimeTranscripts.filter(t => t.isFinal);
      if (finalTranscripts.length > 0) {
        // Use only the last (most complete) final transcript to avoid duplication
        const mostRecentTranscript = finalTranscripts[finalTranscripts.length - 1];
        finalTranscript = mostRecentTranscript.text.trim();
        console.log(`🔍 DEBUG: Using most recent final transcript: ${finalTranscript.length} chars`);
      }
    }
    
    // Clean up session storage
    sessionStorage.removeItem('currentSessionId');
    
    console.log('🔍 DEBUG: Final transcript after database retrieval:', finalTranscript.length, 'chars');
    console.log('🔍 DEBUG: Final transcript preview:', finalTranscript.substring(0, 200));
    console.log('🔍 DEBUG: Final transcript ending:', finalTranscript.slice(-200));
    
    // Final fallback to state-based transcript
    if (!finalTranscript) {
      console.log('🔍 DEBUG: No database transcript available, falling back to state');
      finalTranscript = transcript.trim();
    }
    
    // Clean the final transcript
    const currentTranscript = finalTranscript
      .replace(/Thank you for watching\.?\s*/gi, '')
      .replace(/Thanks for watching\.?\s*/gi, '')
      .trim();
    
    console.log('🔍 DEBUG: After cleaning - currentTranscript length:', currentTranscript.length, 'chars');
    
    console.log('🔍 DEBUG: Final transcript to use for summary:');
    console.log('🔍 DEBUG: Length:', currentTranscript.length, 'characters');
    console.log('🔍 DEBUG: First 200 chars:', currentTranscript.substring(0, 200));
    console.log('🔍 DEBUG: Last 200 chars:', currentTranscript.slice(-200));
    
    // Helper function to convert AudioBuffer to Blob
    const audioBufferToBlob = async (audioBuffer: AudioBuffer): Promise<Blob> => {
      const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );
      
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineContext.destination);
      source.start();
      
      const renderedBuffer = await offlineContext.startRendering();
      
      // Convert to WAV format
      const wavArrayBuffer = audioBufferToWav(renderedBuffer);
      return new Blob([wavArrayBuffer], { type: 'audio/wav' });
    };
    
    // Wait for audio processing to complete and get the latest blobs
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Get current audio blobs after processing is complete
    const currentRecordingBlob = recordingBlob || stereoBlob;
    let currentMicBlob = micBlob;
    let currentSystemBlob = systemBlob;
    
    // If channel-specific audio isn't ready yet, try to get it from the refs
    if (!currentMicBlob && !currentSystemBlob && stereoBlob) {
      console.log('🔄 Channel audio not ready, processing stereo blob directly...');
      try {
        const audioContext = new AudioContext();
        const arrayBuffer = await stereoBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        if (audioBuffer.numberOfChannels >= 2) {
          // Create mono buffers for each channel
          const micBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
          const systemBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
          
          micBuffer.copyToChannel(audioBuffer.getChannelData(0), 0);
          systemBuffer.copyToChannel(audioBuffer.getChannelData(1), 0);
          
          currentMicBlob = await audioBufferToBlob(micBuffer);
          currentSystemBlob = await audioBufferToBlob(systemBuffer);
          
          console.log('✅ Generated channel audio directly for upload', {
            micBlobSize: currentMicBlob.size,
            systemBlobSize: currentSystemBlob.size
          });
        } else {
          // For mono audio, create duplicate copies
          const monoBuffer = audioContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
          monoBuffer.copyToChannel(audioBuffer.getChannelData(0), 0);
          
          currentMicBlob = await audioBufferToBlob(monoBuffer);
          currentSystemBlob = await audioBufferToBlob(monoBuffer);
          
          console.log('✅ Generated duplicate channel audio for mono source', {
            micBlobSize: currentMicBlob.size,
            systemBlobSize: currentSystemBlob.size
          });
        }
        audioContext.close();
      } catch (error) {
        console.error('❌ Failed to process channel audio for upload:', error);
      }
    }
    
    console.log('🎵 Audio blobs status for upload:', {
      recordingBlob: currentRecordingBlob?.size || 'null',
      micBlob: currentMicBlob?.size || 'null', 
      systemBlob: currentSystemBlob?.size || 'null',
      stereoBlob: stereoBlob?.size || 'null'
    });

    // Prepare meeting data with available audio blobs
    const meetingData = {
      title: meetingSettings?.title || initialSettings?.title || 'General Meeting',
      duration: formatDuration(duration),
      wordCount: wordCount,
      transcript: currentTranscript,
      speakerCount: speakerCount,
      startTime: startTime,
      startedBy: user?.email || 'Unknown User',
      practiceId: meetingSettings?.practiceId || initialSettings?.practiceId,
      needsAudioBackup: needsAudioBackup,
      stereoBlob: stereoBlob,
      mixedAudioBlob: currentRecordingBlob,
      leftAudioBlob: currentMicBlob,
      rightAudioBlob: currentSystemBlob
    };

    // Show Notewell AI animation
    setIsGeneratingNotes(true);

    try {
      // Temporarily bypass transcript cleaning to avoid truncation
      let cleanedTranscript = currentTranscript;
      console.log('Skipping transcript cleaning to avoid truncation - using original transcript');

      // Update meeting data with cleaned transcript
      const enhancedMeetingData = {
        ...meetingData,
        transcript: cleanedTranscript,
        rawTranscript: currentTranscript // Use the complete database transcript, not the partial state
      };
      
      console.log('🔍 DEBUG: About to send to generate-meeting-minutes:');
      console.log('🔍 DEBUG: Transcript length:', cleanedTranscript.length);
      console.log('🔍 DEBUG: Transcript ending:', cleanedTranscript.slice(-200));
      console.log('🔍 DEBUG: Full transcript for inspection:', cleanedTranscript);

      // Call the generate-meeting-minutes edge function with cleaned transcript
      const { data: minutesData, error } = await supabase.functions.invoke('generate-meeting-minutes', {
        body: {
          transcript: cleanedTranscript,
          meetingTitle: enhancedMeetingData.title,
          meetingDate: new Date().toLocaleDateString(),
          meetingTime: new Date().toLocaleTimeString(),
          meetingFormat: 'meetingFormat' in meetingSettings ? meetingSettings.meetingFormat : 'teams',
          practiceId: 'practiceId' in meetingSettings ? meetingSettings.practiceId : undefined
        }
      });

      if (error) {
        throw error;
      }

      if (minutesData?.success && minutesData?.meetingMinutes) {
        // Add the generated meeting notes to the meeting data
        const finalMeetingData = {
          ...enhancedMeetingData,
          generatedNotes: minutesData.meetingMinutes,
          meetingFormat: 'meetingFormat' in meetingSettings ? meetingSettings.meetingFormat : 'teams',
          practiceId: 'practiceId' in meetingSettings ? meetingSettings.practiceId : undefined
        };

        setIsGeneratingNotes(false);
        toast.success('Meeting notes generated successfully!');
        
        // Navigate to meeting summary with data and generated notes
        navigate('/meeting-summary', { state: finalMeetingData });
      } else {
        throw new Error('Failed to generate meeting notes');
      }
    } catch (error) {
      console.error('Error generating meeting notes:', error);
      setIsGeneratingNotes(false);
      toast.error('Failed to generate meeting notes. Proceeding without AI notes.');
      
      // Still navigate to meeting summary even if note generation fails, including meeting format
      const fallbackMeetingData = {
        ...meetingData,
        meetingFormat: 'meetingFormat' in meetingSettings ? meetingSettings.meetingFormat : 'teams',
        practiceId: 'practiceId' in meetingSettings ? meetingSettings.practiceId : undefined
      };
      navigate('/meeting-summary', { state: fallbackMeetingData });
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Ready for immediate transcription...':
        return <div className="relative">
          <Mic className="h-4 w-4 text-green-500" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        </div>;
      case 'Processing first speech...':
        return <Waves className="h-4 w-4 text-blue-500 animate-bounce" />;
      case 'First transcription complete - continuing...':
        return <CheckSquare className="h-4 w-4 text-green-500" />;
      case 'Connecting...':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'Error':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        if (connectionStatus.includes('EARLY MODE')) {
          return <div className="relative">
            <Mic className="h-4 w-4 text-blue-500" />
            <div className="absolute -top-1 -right-1 text-xs">⚡</div>
          </div>;
        }
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'Connected':
      case 'Transcription active':
        return 'default';
      case 'Ready for immediate transcription...':
      case 'Processing first speech...':
      case 'First transcription complete - continuing...':
        return 'default';
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        if (connectionStatus.includes('EARLY MODE')) {
          return 'outline';
        }
        return 'secondary';
    }
  };

  // Load meeting history
  const loadMeetingHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    try {
      const { data: meetingsData, error } = await supabase
        .from('accessible_meetings')
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
          mixed_audio_url,
          left_audio_url,
          right_audio_url,
          recording_created_at,
          access_type,
          access_level,
          shared_by,
          shared_at,
          share_message,
          share_id,
          meeting_overviews (
            overview
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get transcript counts, summaries, and documents for each meeting
      const meetingsWithCounts = await Promise.all(
        (meetingsData || []).map(async (meeting) => {
          const [transcriptResult, summaryData, transcriptContent, documentsData] = await Promise.all([
            supabase
              .from('meeting_transcripts')
              .select('*', { count: 'exact', head: true })
              .eq('meeting_id', meeting.id),
            
            supabase
              .from('meeting_summaries')
              .select('summary')
              .eq('meeting_id', meeting.id)
              .maybeSingle(),
              
            supabase
              .from('meeting_transcripts')
              .select('content')
              .eq('meeting_id', meeting.id),

            // Fetch document details
            supabase
              .from('meeting_documents')
              .select('file_name, file_size, uploaded_at, file_type')
              .eq('meeting_id', meeting.id)
              .order('uploaded_at', { ascending: false })
          ]);

          // Calculate word count from transcript content
          let wordCount = 0;
          if (transcriptContent.data && transcriptContent.data.length > 0) {
            wordCount = transcriptContent.data.reduce((total, transcript) => {
              const words = transcript.content.split(/\s+/).filter(word => word.length > 0);
              return total + words.length;
            }, 0);
          }

          const meetingWithOverview = {
            ...meeting,
            transcript_count: transcriptResult.count || 0,
            summary_exists: !!summaryData.data?.summary,
            meeting_summary: summaryData.data?.summary || null,
            overview: meeting.meeting_overviews?.overview || null,
            word_count: wordCount,
            document_count: documentsData.data?.length || 0,
            documents: documentsData.data || []
          };
          
          // Debug log to check overview data
          console.log('Meeting with overview:', {
            id: meeting.id,
            title: meeting.title,
            overview: meetingWithOverview.overview,
            rawOverviews: meeting.meeting_overviews,
            wordCount: wordCount,
            documentCount: meetingWithOverview.document_count
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

  // Fetch mic test service visibility setting
  const fetchMicTestServiceSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('mic_test_service_visible')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching mic test service settings:', error);
        return;
      }
      
      if (data?.mic_test_service_visible !== undefined) {
        setMicTestServiceVisible(data.mic_test_service_visible);
      }
    } catch (error) {
      console.error('Error fetching mic test service settings:', error);
    }
  };

  // Load history when user changes or component mounts
  useEffect(() => {
    if (user) {
      loadMeetingHistory();
      fetchMicTestServiceSettings();
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

  const handleViewTranscript = (meetingId: string) => {
    navigate('/meeting-history', { state: { viewTranscript: meetingId, openDialog: true } });
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      // First, get and delete any associated documents from storage
      const { data: documents } = await supabase
        .from('meeting_documents')
        .select('file_path')
        .eq('meeting_id', meetingId);

      if (documents && documents.length > 0) {
        // Delete files from storage
        const filePaths = documents.map(doc => doc.file_path);
        const { error: storageError } = await supabase.storage
          .from('meeting-documents')
          .remove(filePaths);

        if (storageError) {
          console.warn('Some files could not be deleted from storage:', storageError);
        }

        // Delete document records from database
        await supabase
          .from('meeting_documents')
          .delete()
          .eq('meeting_id', meetingId);
      }

      // Delete transcripts
      await supabase
        .from('meeting_transcripts')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete summaries
      await supabase
        .from('meeting_summaries')
        .delete()
        .eq('meeting_id', meetingId);

      // Delete meeting overviews
      await supabase
        .from('meeting_overviews')
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

  // Pause/Unpause recording functionality
  const pauseRecording = () => {
    try {
      console.log('Pausing recording...');
      setIsPaused(true);
      
      // Pause transcription services
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
      if (iPhoneTranscriberRef.current) {
        iPhoneTranscriberRef.current.stopTranscription();
      }
      if (desktopTranscriberRef.current) {
        desktopTranscriberRef.current.stopTranscription();
      }
      
      // Mute audio streams but keep them alive
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      
      addDebugLog('⏸️ Recording paused - audio muted and transcription stopped');
      toast.success("Recording paused");
    } catch (error) {
      console.error('Error pausing recording:', error);
      toast.error("Failed to pause recording");
    }
  };

  const unpauseRecording = async () => {
    try {
      console.log('Unpausing recording...');
      setIsPaused(false);
      
      // Unmute audio streams
      if (micAudioStreamRef.current) {
        micAudioStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      
      // Resume transcription based on current mode
      if (recordingMode === 'mic-only') {
        await startMicrophoneTranscription();
      } else if (recordingMode === 'mic-and-system') {
        const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
        const isEdge = /Edg/.test(navigator.userAgent);
        if (isChrome || isEdge) {
          await startComputerAudioTranscription();
        } else {
          await startMicrophoneTranscription();
        }
      }
      
      addDebugLog('▶️ Recording resumed - audio unmuted and transcription restarted');
      toast.success("Recording resumed");
    } catch (error) {
      console.error('Error unpausing recording:', error);
      toast.error("Failed to resume recording");
    }
  };

  // Settings handlers
  const handleSettingsChange = (newSettings: any) => {
    setMeetingSettings(newSettings);
  };
              
  // Clean up the stray line
  return (
    <div className="space-y-6">
      {/* Tabbed Interface */}
      <Tabs defaultValue={initialActiveTab || "recorder"} className="w-full">
        <TabsList className={`grid w-full ${micTestServiceVisible ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="recorder" className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            <span className="hidden sm:inline">Meeting Recorder</span>
            <span className="sm:hidden">Record</span>
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <span className="hidden sm:inline">Live Transcript</span>
            <span className="sm:hidden">Transcript</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <span className="hidden sm:inline">Meeting Settings</span>
            <span className="sm:hidden">Settings</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-5 w-5" />
            <span className="hidden sm:inline">Meeting History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
          {micTestServiceVisible && (
            <TabsTrigger value="mic-test" className="flex items-center gap-2">
              <Headphones className="h-5 w-5" />
              <span className="hidden sm:inline">Mic Test Service</span>
              <span className="sm:hidden">Test</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Meeting Recorder Tab - ONLY recording controls */}
        <TabsContent value="recorder" className="space-y-6 mt-6">
          <div className="space-y-4">
            {/* Compact Stats Dashboard */}
            <Card className="bg-gradient-to-br from-background to-muted/30">
              <CardContent className="pt-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Duration */}
                  <div className="text-center p-3 bg-background/50 rounded-lg border border-border/50">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {formatDuration(duration)}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">Duration</div>
                  </div>
                  
                  {/* Word Count / Last Phrase Toggle */}
                  <div 
                    className="text-center p-3 bg-background/50 rounded-lg border border-border/50 cursor-pointer hover:bg-background/70 transition-colors"
                    onClick={() => setShowLastPhrase(!showLastPhrase)}
                  >
                    <div className={`${showLastPhrase ? 'text-sm' : 'text-2xl'} font-bold text-primary mb-1`}>
                      {showLastPhrase ? (lastPhrase || "No words yet") : wordCount}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {showLastPhrase ? "Last Phrase (click for count)" : "Word Count (click for phrase)"}
                    </div>
                  </div>
                  
                  {/* Connection Status */}
                  <div className="text-center p-3 bg-background/50 rounded-lg border border-border/50 hidden">
                    <div className="flex items-center justify-center mb-1">
                       <Badge 
                         variant={getConnectionStatusColor() as any} 
                         className={`flex items-center gap-1 text-xs px-2 py-1 ${
                           connectionStatus === 'Ready for immediate transcription...' || 
                           connectionStatus === 'Processing first speech...' ? 
                           'animate-pulse' : ''
                         }`}
                       >
                         {getConnectionStatusIcon()}
                         <span className="hidden sm:inline">
                           {connectionStatus === 'Ready for immediate transcription...' ? 'Ready for Speech ⚡' :
                            connectionStatus === 'Processing first speech...' ? 'Processing Speech 🎤' :
                            connectionStatus === 'First transcription complete - continuing...' ? 'Transcription Started ✓' :
                            connectionStatus.includes('EARLY MODE') ? 'Fast Mode ⚡' :
                            connectionStatus}
                         </span>
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
                <div className="text-center space-y-4">
                  {!isRecording ? (
                     <div className="space-y-4">
                      
                      <Button 
                        onClick={startRecording}
                        size="lg"
                        className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg"
                      >
                        <Mic className="h-5 w-5 mr-2" />
                        Start Recording
                      </Button>
                    </div>
                  ) : (
                     <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-primary animate-pulse bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 border border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-base font-semibold">
                            {isPaused ? "Recording paused..." : "Recording in progress..."}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Pause/Unpause Button */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={isPaused ? unpauseRecording : pauseRecording}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                              >
                                {isPaused ? (
                                  <Play className="h-4 w-4" />
                                ) : (
                                  <Pause className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{isPaused ? "Resume Recording" : "Pause Recording"}</p>
                            </TooltipContent>
                          </Tooltip>
                          
                          {/* Show/Hide Live Speech Toggle - Hidden on Edge */}
                          {!/Edg/.test(navigator.userAgent) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => setTickerEnabled(prev => { const next = !prev; if (!next) setShowTranscriptSnippet(false); return next; })}
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                                >
                                  {tickerEnabled ? (
                                    <Eye className="h-4 w-4" />
                                  ) : (
                                    <EyeOff className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{tickerEnabled ? "Hide Live Speech" : "Show Live Speech"}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                      
                      {/* Ticker tape for live transcription - Hidden on Edge */}
                      {!/Edg/.test(navigator.userAgent) && (
                        <div className={`transition-all duration-500 ${tickerEnabled ? (showTicker ? 'opacity-100 animate-fade-in' : 'hidden') : 'hidden'}`}>
                          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Waves className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                              <div className="flex-1 overflow-hidden">
                                <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">Live Speech:</div>
                                <div className="text-sm text-blue-600 dark:text-blue-400 truncate">
                                  {tickerText || "Listening..."}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Transcript snippet display - Hidden on Edge */}
                      {!/Edg/.test(navigator.userAgent) && (
                        <div className={`transition-all duration-500 ${showTranscriptSnippet && tickerEnabled ? 'opacity-100 animate-fade-in' : tickerEnabled ? 'opacity-100' : 'hidden'}`}>
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                              <div className="flex-1 overflow-hidden">
                                <div className="text-sm text-green-700 dark:text-green-300 font-medium">Most recent transcribed...</div>
                                <div className="text-xs text-green-600 dark:text-green-400">
                                {transcriptSnippet ? 
                                  `“${transcriptSnippet.split(' ').slice(0, 20).join(' ')}${transcriptSnippet.split(' ').length > 20 ? '...' : ''}”`
                                  : "No speech detected yet..."
                                }
                              </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                       <Button 
                        onClick={stopRecording}
                        variant="destructive"
                        size="lg"
                        disabled={isStoppingRecording}
                        className="shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 px-8 py-4 text-base font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <Square className="h-5 w-5 mr-2" />
                        {isStoppingRecording ? "Ending Recording..." : (isPaused ? "Meeting Paused" : "Stop Recording")}
                       </Button>
                      </div>
                   )}
                   
                     {/* Recording Audio Player - Show after recording stops (controlled by micTestServiceVisible) */}
                      {recordingAudioUrl && !isRecording && micTestServiceVisible && (
                       <div className="mt-4 space-y-3">
                        {/* Mixed Stereo Playback */}
                        <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-full bg-accent/20">
                                <Headphones className="h-4 w-4 text-accent" />
                              </div>
                              <span className="text-sm font-medium">Mixed Recording (Left + Right Channels):</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (recordingAudioRef.current) {
                                  if (recordingAudioRef.current.paused) {
                                    recordingAudioRef.current.play();
                                  } else {
                                    recordingAudioRef.current.pause();
                                  }
                                }
                              }}
                              className="flex items-center gap-2"
                            >
                              <Play className="h-3 w-3" />
                              Play Mixed
                            </Button>
                          </div>
                          <audio
                            ref={recordingAudioRef}
                            src={recordingAudioUrl}
                            controls
                            className="w-full h-10"
                            preload="metadata"
                          />
                        </div>

                        {/* Left Channel (Microphone) Playback */}
                        {micAudioUrl && (
                          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900/50">
                                  <Mic className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-medium">Left Channel Recording (Microphone):</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (micAudioRef.current) {
                                    if (micAudioRef.current.paused) {
                                      micAudioRef.current.play();
                                    } else {
                                      micAudioRef.current.pause();
                                    }
                                  }
                                }}
                                className="flex items-center gap-2"
                              >
                                <Play className="h-3 w-3" />
                                Play Left
                              </Button>
                            </div>
                            <audio
                              ref={micAudioRef}
                              src={micAudioUrl}
                              controls
                              className="w-full h-10"
                              preload="metadata"
                            />
                          </div>
                        )}

                        {/* Right Channel (System Audio) Playback */}
                        {systemAudioUrl && (
                          <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/50">
                                  <Monitor className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <span className="text-sm font-medium">Right Channel Recording (System Audio):</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (systemAudioRef.current) {
                                    if (systemAudioRef.current.paused) {
                                      systemAudioRef.current.play();
                                    } else {
                                      systemAudioRef.current.pause();
                                    }
                                  }
                                }}
                                className="flex items-center gap-2"
                              >
                                <Play className="h-3 w-3" />
                                Play Right
                              </Button>
                            </div>
                            <audio
                              ref={systemAudioRef}
                              src={systemAudioUrl}
                              controls
                              className="w-full h-10"
                              preload="metadata"
                            />
                          </div>
                        )}
                      </div>
                    )}
                 </div>

                {/* Compact Mic Control */}
                <div className="text-center py-4 mt-4 border-t border-border/50">
                  <div className="max-w-sm mx-auto">
                    <button
                      type="button"
                      onClick={() => { isRecording ? stopRecording() : startRecording(); }}
                      className="p-2 rounded-full bg-primary/5 w-12 h-12 mx-auto mb-2 flex items-center justify-center transition-colors cursor-pointer hover:bg-primary/10"
                      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                      title={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                      <Mic className={`h-6 w-6 ${isRecording ? 'text-red-500' : 'text-primary/60'}`} />
                    </button>
                    {!isRecording ? (
                      <>
                        <h4 className="text-base font-medium mb-1">Ready to Record</h4>
                        <p className="text-xs text-muted-foreground">
                          Allow Microphone Access if Requested
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="text-base font-medium mb-1 text-red-600">Recording...</h4>
                        <p className="text-xs text-muted-foreground">
                          Your meeting audio is being captured
                        </p>
                      </>
                    )}
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


              </CardContent>
            </Card>
          </div>
          
          {/* Reset Meeting Button - Bottom Center */}
          <div className="flex justify-center pt-4">
            <Button 
              onClick={resetMeeting}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-2" />
              Reset Meeting
            </Button>
          </div>
        </TabsContent>


        <TabsContent value="transcript" className="space-y-4 mt-6">
          <Card className="border-accent/30">
              <CardContent className="space-y-4">
              {/* Live Transcript with Enhanced Two-Section Layout */}
              <LiveTranscript
                transcript={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.text || "" : ""}
                confidence={realtimeTranscripts.length > 0 ? realtimeTranscripts[realtimeTranscripts.length - 1]?.confidence : undefined}
                showTimestamps={true}
                onTimestampsToggle={() => {}}
                attendees={""}
                meetingSettings={{
                  practiceId: (meetingSettings as any)?.practiceId || "",
                  meetingFormat: (meetingSettings as any)?.meetingFormat || "teams"
                }}
                onMeetingSettingsChange={(settings) => {
                  setMeetingSettings(prev => ({
                    ...prev,
                    practiceId: settings.practiceId,
                    meetingFormat: settings.meetingFormat
                  }));
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>


        {/* Meeting Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-6">
          <MeetingSettings
            onSettingsChange={handleSettingsChange}
            onTranscriptImported={(importedTranscript) => {
              // Handle imported transcript by setting it as the current transcript
              setTranscript(importedTranscript.content);
              setWordCount(importedTranscript.wordCount);
              
              // Update meeting data with imported content
              const currentMeetingData = {
                transcript: importedTranscript.content,
                title: meetingSettings.title || "General Meeting"
              };
              
              // Update the transcript in the UI
              onTranscriptUpdate(importedTranscript.content);
              
              // Enable generate button by setting duration to 1 second
              setDuration(1);
              onDurationUpdate("00:01");
              
              console.log('📄 Transcript imported successfully:', importedTranscript.wordCount, 'words');
            }}
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
                onViewTranscript={handleViewTranscript}
                onDelete={handleDeleteMeeting}
                loading={loadingHistory}
                isSelectMode={isSelectMode}
                selectedMeetings={selectedMeetings}
                onSelectMeeting={handleSelectMeeting}
                onMeetingUpdate={(meetingId, updatedTitle) => {
                  // Update the local meetings array
                  setMeetings(prev => prev.map(meeting => 
                    meeting.id === meetingId 
                      ? { ...meeting, title: updatedTitle }
                      : meeting
                  ));
                }}
                onDocumentsUploaded={(meetingId, uploadedFiles) => {
                  // Update the local meetings array with new documents
                  setMeetings(prev => prev.map(meeting => {
                    if (meeting.id === meetingId) {
                      const existingDocuments = meeting.documents || [];
                      const newDocuments = [...existingDocuments, ...uploadedFiles];
                      return {
                        ...meeting,
                        document_count: newDocuments.length,
                        documents: newDocuments
                      };
                    }
                    return meeting;
                  }));
                 }}
                showRecordingPlayback={micTestServiceVisible}
               />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mic Test Service Tab */}
        {micTestServiceVisible && (
          <TabsContent value="mic-test" className="space-y-4 mt-6">
            <Tabs defaultValue="whisper-test" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="whisper-test">Whisper Hallucination Test</TabsTrigger>
                <TabsTrigger value="mic-input-test">Speaker Capture Test</TabsTrigger>
              </TabsList>
              
              <TabsContent value="whisper-test" className="mt-6">
                <WhisperHallucinationTestSuite />
              </TabsContent>
              
              <TabsContent value="mic-input-test" className="mt-6">
                <MicInputRecordingTester />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

      </Tabs>
      
      <NotewellAIAnimation isVisible={isGeneratingNotes} />
    </div>
  );
};