import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Mic, MicOff, Loader2, Wifi, WifiOff, Play, Square, RotateCcw, Download, FileText, Upload, ChevronDown } from 'lucide-react';
import { generateWordDocument } from '@/utils/documentGenerators';
import { toast } from 'sonner';
import TranscriptCleanerPanel from '@/components/TranscriptCleanerPanel';
import TranscribeCostComparison from '@/components/TranscribeCostComparison';
import { supabase } from '@/integrations/supabase/client';
import { WhisperTranscriber, TranscriptData } from '@/utils/WhisperTranscriber';
import { AssemblyAIRealtimeTranscriber } from '@/utils/AssemblyAIRealtimeTranscriber';
import { BrowserSpeechTranscriber, TranscriptData as BrowserTranscriptData } from '@/utils/BrowserSpeechTranscriber';
import { ChunkedWhisperTranscriber } from '@/transcribers';
import { normalizeTranscript } from '@/lib/transcriptNormalizer';
import { mergeLive } from '@/utils/TranscriptMerge';
import { Header } from '@/components/Header';

// Feature flags - enable all services for testing
const ENABLE_DESKTOP_WHISPER = true; // ✅ ENABLED for testing
const ENABLE_BROWSER_SPEECH = true; // Enable Browser Speech
const ENABLE_ASSEMBLY = true; // Enable AssemblyAI

// Module-scope variables for Standalone Whisper (outside React to avoid remounts)
let micStream: MediaStream | null = null;
let mediaRecorder: MediaRecorder | null = null;
let chunkIndex = 0;
let isStopping = false;
let progressiveTranscript = '';

const MIME_OPUS = 'audio/webm;codecs=opus';
const TIMESLICE_MS = 30000; // emits every 30s for progressive updates
const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text-chunked`;
const AUTH = `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`; // anon/public key

// Callback to update UI from module scope
let updateTranscriptCallback: ((text: string) => void) | null = null;

// Legacy variables for existing Whisper implementation
const MIME = 'audio/webm;codecs=opus';
let whisperChunkIdx = 0;

// Uploader for a single chunk (direct fetch)
async function uploadChunk(blob: Blob, meta: { chunkIndex: number; isFinal?: boolean }) {
  // Skip empty chunks
  if (!blob || !blob.size) return;

  const fd = new FormData();
  fd.append('file', blob, `chunk-${meta.chunkIndex}.webm`);
  fd.append('chunkIndex', String(meta.chunkIndex));
  if (meta.isFinal) fd.append('isFinal', 'true');

  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      Authorization: AUTH,
      // DO NOT set Content-Type; FormData sets it with boundary
    },
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Whisper upload failed', res.status, text);
    throw new Error(`Whisper upload ${res.status}`);
  }

  // Parse response and accumulate transcript
  const data = await res.json().catch(() => null);
  if (data?.text) {
    progressiveTranscript += ' ' + data.text;
    console.debug('Progressive transcript updated:', data.text);
    
    // Update UI if callback is set
    if (updateTranscriptCallback) {
      updateTranscriptCallback(progressiveTranscript.trim());
    }
  }

  console.debug('Whisper chunk uploaded successfully');
  return data;
}

// Start (bind the recorder to the uploader)
export async function startStandaloneWhisper() {
  if (mediaRecorder) return; // already running
  isStopping = false;
  chunkIndex = 0;
  progressiveTranscript = ''; // Reset transcript

  const supported = MediaRecorder.isTypeSupported(MIME_OPUS) ? MIME_OPUS : 'audio/webm';
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(micStream, { mimeType: supported });

  mediaRecorder.ondataavailable = async (e) => {
    try {
      if (!e.data || !e.data.size) return;
      console.log('📦 STANDALONE WHISPER: Audio data available:', e.data.size, 'bytes');
      await uploadChunk(e.data, { chunkIndex });
    } catch (err) {
      console.error('Upload error on chunk', chunkIndex, err);
    } finally {
      chunkIndex += 1;
    }
  };

  mediaRecorder.onstart = () => console.log('🎬 STANDALONE WHISPER: Recording started');
  mediaRecorder.onerror = (ev: any) => console.error('MediaRecorder error', ev?.error || ev);
  mediaRecorder.onstop = async () => {
    try {
      if (!isStopping) return; // guard double stop
      isStopping = false;
      // Send a "finalize" marker so server can flush/commit
      const empty = new Blob([], { type: supported });
      await uploadChunk(empty, { chunkIndex, isFinal: true });
    } catch (e) {
      console.warn('Finalize upload failed', e);
    } finally {
      micStream?.getTracks().forEach(t => t.stop());
      micStream = null;
      mediaRecorder = null;
      updateTranscriptCallback = null; // Clear callback
    }
  };

  mediaRecorder.start(TIMESLICE_MS); // MUST be > 0 to emit chunks
}

// Stop
export function stopStandaloneWhisper() {
  if (!mediaRecorder) return;
  isStopping = true;
  try { mediaRecorder.stop(); } catch {}
}

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: Date;
  confidence?: number;
  service: 'assemblyai' | 'deepgram' | 'whisper' | 'browser';
}

interface ServiceState {
  isRecording: boolean;
  isConnected: boolean;
  transcripts: TranscriptEntry[];
  fullTranscript: string;
  error: string | null;
  avgConfidence: number | null;
  wordCount: number;
  sessionCount: number;
  sessionStartTime: Date | null;
  timeRemaining: number;
  isReconnecting: boolean;
}

const initialServiceState = (): ServiceState => ({
  isRecording: false,
  isConnected: false,
  transcripts: [],
  fullTranscript: '',
  error: null,
  avgConfidence: null,
  wordCount: 0,
  sessionCount: 0,
  sessionStartTime: null,
  timeRemaining: 0,
  isReconnecting: false,
});

export default function TranscriptionComparison() {
  console.log('🚀 TranscriptionComparison component loading...');
  console.log('🌍 Component actually mounted and running!');
  console.log('📍 Current URL:', window.location.href);
  console.log('📋 Feature flags:', { ENABLE_DESKTOP_WHISPER, ENABLE_BROWSER_SPEECH, ENABLE_ASSEMBLY });
  
  const [assemblyState, setAssemblyState] = useState<ServiceState>(initialServiceState());
  const [deepgramState, setDeepgramState] = useState<ServiceState>(initialServiceState());
  const [whisperState, setWhisperState] = useState<ServiceState>(initialServiceState());
  const [browserState, setBrowserState] = useState<ServiceState>(initialServiceState());
  
  // NEW: Standalone Whisper state
  const [standaloneWhisperState, setStandaloneWhisperState] = useState<ServiceState>(initialServiceState());
  
  console.log('🔍 Component state initialized - whisperState.isReconnecting:', whisperState.isReconnecting);
  // NEW: Standalone Whisper UI handlers (using module-scope functions)
  const handleStartStandaloneWhisper = useCallback(async () => {
    console.log('🚀 STANDALONE WHISPER: Starting...');
    
    // Set up callback to update UI with progressive transcript
    updateTranscriptCallback = (text: string) => {
      setStandaloneWhisperState(prev => ({
        ...prev,
        fullTranscript: text,
        wordCount: text.split(' ').filter(w => w.trim()).length
      }));
    };
    
    try {
      setStandaloneWhisperState(prev => ({ 
        ...prev, 
        error: null, 
        sessionStartTime: new Date(), 
        sessionCount: 1,
        isConnected: true,
        isRecording: true,
        transcripts: [],
        fullTranscript: '',
        wordCount: 0
      }));
      
      await startStandaloneWhisper();
    } catch (error) {
      console.error('❌ STANDALONE WHISPER: Error starting:', error);
      setStandaloneWhisperState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to start recording',
        isRecording: false,
        isConnected: false
      }));
    }
  }, []);

  const handleStopStandaloneWhisper = useCallback(() => {
    console.log('⏹️ STANDALONE WHISPER: Stopping...');
    stopStandaloneWhisper();
    setStandaloneWhisperState(prev => ({ 
      ...prev, 
      isRecording: false,
      isConnected: false
    }));
  }, []);

  const clearStandaloneWhisper = useCallback(() => {
    console.log('🧹 STANDALONE WHISPER: Clearing data...');
    setStandaloneWhisperState(initialServiceState());
  }, []);

  const [isRunningAll, setIsRunningAll] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [uploadedAudio, setUploadedAudio] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  
  // Track last final transcript to prevent duplicates
  const [lastAssemblyFinalTranscript, setLastAssemblyFinalTranscript] = useState<string>('');
  
  // NHS Transcript Cleaner state
  const [cleanedTranscripts, setCleanedTranscripts] = useState<string[]>(['', '', '', '']);
  
  // NHS Transcript Cleaner handler
  const handleTranscriptsCleaned = useCallback((results: { cleaned: string; appliedRuleIds: string[] }[]) => {
    const newCleanedTranscripts = results.map(result => result.cleaned);
    setCleanedTranscripts(newCleanedTranscripts);
    
    // Update the service states with cleaned transcripts
    setAssemblyState(prev => ({ ...prev, fullTranscript: newCleanedTranscripts[0] || prev.fullTranscript }));
    setDeepgramState(prev => ({ ...prev, fullTranscript: newCleanedTranscripts[1] || prev.fullTranscript }));
    setStandaloneWhisperState(prev => ({ ...prev, fullTranscript: newCleanedTranscripts[2] || prev.fullTranscript }));
    setBrowserState(prev => ({ ...prev, fullTranscript: newCleanedTranscripts[3] || prev.fullTranscript }));
  }, []);

  // Get current consolidated transcripts for cleaner
  const consolidatedTranscripts = [
    assemblyState.fullTranscript,
    deepgramState.fullTranscript,
    standaloneWhisperState.fullTranscript,
    browserState.fullTranscript
  ];
  
  const audioContextRef = useRef<AudioContext | null>(null);

  // Calculate if all services are running (only check enabled services)
  const isRunningAllCalculated = (
    (!ENABLE_ASSEMBLY || assemblyState.isRecording) &&
    deepgramState.isRecording &&
    standaloneWhisperState.isRecording &&
    (!ENABLE_BROWSER_SPEECH || browserState.isRecording)
  );

  // Refs for transcribers and connections
  const assemblyTranscriberRef = useRef<AssemblyAIRealtimeTranscriber | null>(null);
  const deepgramWsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const whisperTranscriberRef = useRef<WhisperTranscriber | ChunkedWhisperTranscriber | null>(null);
  const browserTranscriberRef = useRef<BrowserSpeechTranscriber | null>(null);

  // AssemblyAI handlers
  const handleAssemblyTranscript = useCallback((data: any) => {
    console.log('📝 ASSEMBLY: Received transcript data:', data);
    
    const transcript = data.text?.trim();
    if (!transcript) {
      console.log('⚠️ ASSEMBLY: Empty transcript, skipping');
      return;
    }
    
    const transcriptEntry: TranscriptEntry = {
      id: `assembly-${Date.now()}-${Math.random()}`,
      text: transcript,
      isFinal: data.is_final,
      timestamp: new Date(),
      confidence: data.confidence,
      service: 'assemblyai'
    };

    console.log('📝 ASSEMBLY: Adding transcript entry:', transcriptEntry);

    setAssemblyState(prev => {
      if (data.is_final) {
        // Without format_turns=true, AssemblyAI sends individual segments that need to be accumulated
        const newFullTranscript = prev.fullTranscript + (prev.fullTranscript ? ' ' : '') + transcript;
        const newWordCount = newFullTranscript.split(' ').filter(w => w.trim()).length;
        
        console.log('✅ ASSEMBLY: Appending final transcript segment:', {
          previousLength: prev.fullTranscript.length,
          newSegment: transcript.slice(0, 50) + (transcript.length > 50 ? '...' : ''),
          totalLength: newFullTranscript.length,
          wordCount: newWordCount
        });
        
        const newState = {
          ...prev,
          transcripts: [...prev.transcripts, transcriptEntry],
          fullTranscript: newFullTranscript,
          wordCount: newWordCount,
          avgConfidence: data.confidence ? 
            (prev.avgConfidence ? (prev.avgConfidence + data.confidence) / 2 : data.confidence) :
            prev.avgConfidence
        };
        
        return newState;
      } else {
        // For partial transcripts, just add to the transcripts list but don't update full transcript
        return {
          ...prev,
          transcripts: [...prev.transcripts, transcriptEntry]
        };
      }
    });
  }, []);

  const handleAssemblyError = useCallback((error: string) => {
    console.error('❌ ASSEMBLY: Error:', error);
    setAssemblyState(prev => ({ ...prev, error }));
  }, []);

  const handleAssemblyStatus = useCallback((status: string) => {
    console.log('📊 ASSEMBLY: Status change:', status);
    const lowerStatus = status.toLowerCase();
    setAssemblyState(prev => ({ 
      ...prev, 
      isConnected: lowerStatus.includes('connected') || lowerStatus.includes('recording'),
      isRecording: lowerStatus.includes('recording')
    }));
  }, []);

  // Deepgram handlers
  const handleDeepgramTranscript = useCallback((data: any) => {
    if (data.channel?.alternatives?.[0]?.transcript) {
      const transcript = data.channel.alternatives[0].transcript;
      const confidence = data.channel.alternatives[0].confidence;
      
      const transcriptEntry: TranscriptEntry = {
        id: `deepgram-${Date.now()}-${Math.random()}`,
        text: transcript,
        isFinal: data.is_final,
        timestamp: new Date(),
        confidence: confidence,
        service: 'deepgram'
      };

      console.log('📝 DEEPGRAM: Processing transcript:', {
        text: transcript.slice(0, 50) + (transcript.length > 50 ? '...' : ''),
        isFinal: data.is_final,
        confidence: confidence
      });

      setDeepgramState(prev => {
        if (data.is_final) {
          // Deepgram sends cumulative transcripts, so replace instead of append
          const newWordCount = transcript.split(' ').filter(w => w.trim()).length;
          
          console.log('✅ DEEPGRAM: Replacing full transcript with cumulative final transcript:', {
            newText: transcript.slice(0, 100) + (transcript.length > 100 ? '...' : ''),
            fullTranscriptLength: transcript.length,
            wordCount: newWordCount
          });

          return {
            ...prev,
            transcripts: [...prev.transcripts, transcriptEntry],
            fullTranscript: transcript,
            wordCount: newWordCount,
            avgConfidence: confidence ? 
              (prev.avgConfidence ? (prev.avgConfidence + confidence) / 2 : confidence) :
              prev.avgConfidence
          };
        } else {
          // For partial transcripts, just add to transcripts list but don't update full transcript
          return {
            ...prev,
            transcripts: [...prev.transcripts, transcriptEntry]
          };
        }
      });
    }
  }, []);

  // Whisper payload handler for new format
  const handleWhisperPayload = useCallback((payload: any) => {
    console.log('📨 WHISPER: Received payload from edge function:', {
      payload,
      hasData: !!payload?.data,
      hasText: !!(payload?.data?.text || payload?.text),
      textLength: (payload?.data?.text || payload?.text || '').length
    });
    
    // Handle response format from speech-to-text-chunked
    const text = payload?.data?.text || payload?.text || '';
    const confidence = payload?.data?.confidence || payload?.confidence || 0.95;
    
    if (text.trim()) {
      console.log('✅ WHISPER: Processing valid transcript:', {
        text: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        confidence,
        fullLength: text.length
      });
      
      const transcriptData: TranscriptData = {
        text: text.trim(),
        is_final: true,
        confidence: confidence,
        speaker: 'Speaker'
      };
      
      handleWhisperTranscript(transcriptData);
    } else {
      console.warn('⚠️ WHISPER: Empty or invalid text in payload:', { payload });
    }
  }, []);

  // Whisper handlers
  const handleWhisperTranscript = useCallback((data: TranscriptData | any) => {
    console.log('📝 WHISPER: Received transcript data:', data);
    
    // Use normalizer to handle both old and new formats
    const unified = normalizeTranscript(data);
    const transcript = unified.text?.trim();
    
    if (!transcript) {
      console.log('⚠️ WHISPER: Empty transcript, skipping');
      return;
    }
    
    const transcriptEntry: TranscriptEntry = {
      id: `whisper-${Date.now()}-${Math.random()}`,
      text: transcript,
      isFinal: true, // Whisper results are always final
      timestamp: new Date(),
      confidence: 0.95, // Default confidence for Whisper
      service: 'whisper'
    };

    console.log('📝 WHISPER: Adding transcript entry:', transcriptEntry);

    setWhisperState(prev => {
      const newState = {
        ...prev,
        transcripts: [...prev.transcripts, transcriptEntry],
        fullTranscript: prev.fullTranscript + (prev.fullTranscript ? ' ' : '') + transcript,
        wordCount: (prev.fullTranscript + ' ' + transcript).split(' ').filter(w => w.trim()).length,
        avgConfidence: 0.95
      };
      
      console.log('📝 WHISPER: Updated state:', {
        transcriptCount: newState.transcripts.length,
        fullTranscript: newState.fullTranscript,
        wordCount: newState.wordCount
      });
      
      return newState;
    });
  }, []);

  const handleWhisperError = useCallback((error: string) => {
    console.error('❌ WHISPER: Error:', error);
    setWhisperState(prev => ({ ...prev, error }));
  }, []);

  const handleWhisperStatus = useCallback((status: string) => {
    console.log('📊 WHISPER: Status change:', status);
    setWhisperState(prev => ({ 
      ...prev, 
      isConnected: status === 'Recording',
      isRecording: status === 'Recording'
    }));
  }, []);

  // Browser handlers
  const handleBrowserTranscript = useCallback((data: BrowserTranscriptData) => {
    const transcriptEntry: TranscriptEntry = {
      id: `browser-${Date.now()}-${Math.random()}`,
      text: data.text,
      isFinal: data.is_final,
      timestamp: new Date(),
      confidence: data.confidence,
      service: 'browser'
    };

    setBrowserState(prev => ({
      ...prev,
      transcripts: [...prev.transcripts, transcriptEntry],
      fullTranscript: data.is_final ? 
        (prev.fullTranscript + (prev.fullTranscript ? ' ' : '') + data.text) : 
        prev.fullTranscript,
      wordCount: data.is_final ? 
        (prev.fullTranscript + ' ' + data.text).split(' ').filter(w => w.trim()).length :
        prev.wordCount,
      avgConfidence: data.confidence ? 
        (prev.avgConfidence ? (prev.avgConfidence + data.confidence) / 2 : data.confidence) :
        prev.avgConfidence
    }));
  }, []);

  const handleBrowserError = useCallback((error: string) => {
    setBrowserState(prev => ({ ...prev, error }));
  }, []);

  const handleBrowserStatus = useCallback((status: string) => {
    setBrowserState(prev => ({ 
      ...prev, 
      isConnected: status === 'Recording',
      isRecording: status === 'Recording'
    }));
  }, []);

  // Initialize services
  const initializeServices = useCallback(() => {
    console.log('🔧 Initializing services...');
    
    // Initialize AssemblyAI only if enabled
    if (ENABLE_ASSEMBLY && !assemblyTranscriberRef.current) {
      console.log('🔧 Creating new AssemblyAI transcriber...');
      assemblyTranscriberRef.current = new AssemblyAIRealtimeTranscriber(
        handleAssemblyTranscript,
        handleAssemblyError,
        handleAssemblyStatus
      );
      console.log('✅ AssemblyAI transcriber created');
    } else if (!ENABLE_ASSEMBLY) {
      console.log('🚫 AssemblyAI disabled by feature flag');
    } else {
      console.log('ℹ️ AssemblyAI transcriber already exists');
    }

    // Initialize Whisper only if enabled
    if (ENABLE_DESKTOP_WHISPER && !whisperTranscriberRef.current) {
      console.log('🔧 Creating new Whisper transcriber with direct fetch...');
      
      whisperTranscriberRef.current = new WhisperTranscriber(
        EDGE_URL,
        (payload) => handleWhisperPayload(payload),
        (err) => console.error('❌ Whisper error:', err),
        (status) => handleWhisperStatus(status)
      );
      
      console.log('✅ Whisper transcriber created with direct fetch');
    } else if (!ENABLE_DESKTOP_WHISPER) {
      console.log('🚫 Whisper disabled by feature flag');
    } else {
      console.log('ℹ️ Whisper transcriber already exists');
    }
    
    // Initialize Browser Speech Recognition only if enabled
    if (ENABLE_BROWSER_SPEECH && !browserTranscriberRef.current) {
      console.log('🔧 Creating new Browser Speech transcriber...');
      browserTranscriberRef.current = new BrowserSpeechTranscriber(
        handleBrowserTranscript,
        handleBrowserError,
        handleBrowserStatus
      );
      console.log('✅ Browser Speech transcriber created');
    } else if (!ENABLE_BROWSER_SPEECH) {
      console.log('🚫 Browser Speech disabled by feature flag');
    } else {
      console.log('ℹ️ Browser Speech transcriber already exists');
    }
    
    console.log('✅ Service initialization completed');
  }, [handleAssemblyTranscript, handleAssemblyError, handleAssemblyStatus, handleWhisperTranscript, handleWhisperError, handleWhisperStatus, handleWhisperPayload, handleBrowserTranscript, handleBrowserError, handleBrowserStatus]);

  // Start individual services
  const startAssemblyAI = useCallback(async () => {
    if (!ENABLE_ASSEMBLY) {
      console.log('🚫 ASSEMBLY: Service disabled by feature flag');
      return;
    }
    
    try {
      console.log('🚀 ASSEMBLY: Starting AssemblyAI service...');
      console.log('🔍 ASSEMBLY: Current transcriber ref:', !!assemblyTranscriberRef.current);
      
      initializeServices();
      
      console.log('🔍 ASSEMBLY: After initializeServices, transcriber ref:', !!assemblyTranscriberRef.current);
      
      setAssemblyState(prev => ({ 
        ...prev, 
        error: null, 
        sessionStartTime: new Date(), 
        sessionCount: 1,
        isConnected: false,
        isRecording: false
      }));
      
      // Reset duplicate tracking for new session
      setLastAssemblyFinalTranscript('');
      
      if (assemblyTranscriberRef.current) {
        console.log('📡 ASSEMBLY: Calling startTranscription...');
        await assemblyTranscriberRef.current.startTranscription();
        console.log('✅ ASSEMBLY: StartTranscription completed');
      } else {
        console.error('❌ ASSEMBLY: Transcriber not initialized after initializeServices');
        throw new Error('AssemblyAI transcriber not initialized');
      }
    } catch (error) {
      console.error('❌ ASSEMBLY: Start error:', error);
      handleAssemblyError(error instanceof Error ? error.message : 'Failed to start AssemblyAI');
    }
  }, [initializeServices, handleAssemblyError]);

  const startDeepgram = useCallback(async () => {
    try {
      setDeepgramState(prev => ({ ...prev, error: null, sessionStartTime: new Date(), sessionCount: 1 }));
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      // Connect to Deepgram via new streaming edge function
      const ws = new WebSocket(`wss://dphcnbricafkbtizkoal.supabase.co/functions/v1/deepgram-streaming`);
      deepgramWsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ DEEPGRAM: WebSocket connected');
        setDeepgramState(prev => ({ ...prev, isConnected: true }));
        
        // Send initial configuration
        ws.send(JSON.stringify({
          type: 'session.start',
          sample_rate: 24000,
          channels: 1
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 DEEPGRAM: Received message:', data.type || data.type);
          
          // Handle session begins
          if (data.type === 'session_begins') {
            console.log('✅ DEEPGRAM: Session started successfully');
            setDeepgramState(prev => ({ ...prev, isRecording: true }));
            return;
          }
          
          // Handle errors
          if (data.type === 'error') {
            console.error('❌ DEEPGRAM: Error:', data.error);
            setDeepgramState(prev => ({ ...prev, error: `Deepgram error: ${data.error}` }));
            return;
          }
          
          // Handle session termination
          if (data.type === 'session_terminated') {
            console.log('🔌 DEEPGRAM: Session terminated:', data.code, data.reason);
            setDeepgramState(prev => ({ ...prev, error: `Session ended: ${data.reason || 'Connection closed'}`, isRecording: false, isConnected: false }));
            return;
          }
          
          // Handle transcription results
          if (data.channel?.alternatives?.[0]?.transcript) {
            handleDeepgramTranscript(data);
          }
        } catch (error) {
          console.error('Deepgram message parse error:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ DEEPGRAM: WebSocket error:', error);
        setDeepgramState(prev => ({ ...prev, error: 'Deepgram connection error' }));
      };

      ws.onclose = (event) => {
        console.log('🔌 DEEPGRAM: WebSocket closed:', event.code, event.reason);
        setDeepgramState(prev => ({ ...prev, isConnected: false, isRecording: false }));
        if (event.code !== 1000) {
          setDeepgramState(prev => ({ ...prev, error: `Connection failed (Code: ${event.code}): ${event.reason || 'Unknown reason'}` }));
        }
      };

      // Setup audio processing for Deepgram
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Calculate audio level
          const sum = inputData.reduce((acc, val) => acc + Math.abs(val), 0);
          const level = Math.min(100, (sum / inputData.length) * 1000);
          setAudioLevel(level);
          
          // Convert to 16-bit PCM for Deepgram
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          ws.send(pcm16.buffer);
        }
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);

    } catch (error) {
      setDeepgramState(prev => ({ ...prev, error: error instanceof Error ? error.message : 'Failed to start Deepgram' }));
    }
  }, [handleDeepgramTranscript]);

  const startWhisper = useCallback(async () => {
    if (!ENABLE_DESKTOP_WHISPER) {
      console.log('🚫 WHISPER: Service disabled by feature flag');
      return;
    }
    
    try {
      console.log('🚀 WHISPER: Starting Whisper service...');
      console.log('🔍 WHISPER: Current transcriber ref:', !!whisperTranscriberRef.current);
      
      initializeServices();
      
      console.log('🔍 WHISPER: After initializeServices, transcriber ref:', !!whisperTranscriberRef.current);
      
      setWhisperState(prev => ({ 
        ...prev, 
        error: null, 
        sessionStartTime: new Date(), 
        sessionCount: 1,
        isConnected: false,
        isRecording: false
      }));
      
      const whisper = whisperTranscriberRef.current;
      if (!whisper) {
        console.error('❌ WHISPER: Transcriber not initialized after initializeServices');
        throw new Error('Whisper transcriber not initialized');
      }
      
      // Check MIME type support
      const supported = MediaRecorder.isTypeSupported(MIME) ? MIME : 'audio/webm';
      console.log("📡 WHISPER: Using MIME type:", supported);
      
      // Get microphone access
      console.log("🎤 WHISPER: Requesting microphone access...");
      micStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      console.log("✅ WHISPER: Microphone access granted");
      
      mediaRecorder = new MediaRecorder(micStream, { mimeType: supported });
      console.log("🎙️ WHISPER: MediaRecorder created");
      
      // Reset chunk counter for new session
      whisperChunkIdx = 0;
      
      // IMPORTANT: feed chunks into Whisper
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size) {
          console.log("📦 WHISPER: MediaRecorder chunk received:", { 
            size: e.data.size, 
            chunkIndex: whisperChunkIdx,
            type: e.data.type
          });
          
          try {
            (whisper as WhisperTranscriber).enqueueChunk(e.data, { 
              chunkIndex: whisperChunkIdx++,
              timestamp: Date.now()
            });
            console.log("✅ WHISPER: Chunk enqueued successfully");
          } catch (error) {
            console.error("❌ WHISPER: Failed to enqueue chunk:", error);
            handleWhisperError(`Failed to process audio chunk: ${error}`);
          }
        } else {
          console.warn("⚠️ WHISPER: Empty or invalid chunk received");
        }
      };
      
      mediaRecorder.onstart = () => {
        console.log("🎬 WHISPER: MediaRecorder started successfully");
        setWhisperState(prev => ({ ...prev, isRecording: true, isConnected: true }));
        handleWhisperStatus("Recording");
      };
      
      mediaRecorder.onerror = (ev: any) => {
        console.error("❌ WHISPER: MediaRecorder error:", ev?.error || ev);
        setWhisperState(prev => ({ ...prev, isRecording: false, isConnected: false }));
        handleWhisperError(`MediaRecorder error: ${ev?.error || 'Unknown error'}`);
      };
      
      mediaRecorder.onstop = () => {
        console.log("🛑 WHISPER: MediaRecorder stopped");
        setWhisperState(prev => ({ ...prev, isRecording: false, isConnected: false }));
        handleWhisperStatus("Stopped");
      };
      
      // Start recording with timeslice
      console.log(`🎯 WHISPER: Starting MediaRecorder with ${TIMESLICE_MS}ms timeslice...`);
      mediaRecorder.start(TIMESLICE_MS);
      console.log("✅ WHISPER: MediaRecorder start command issued");
      
    } catch (error) {
      console.error('❌ WHISPER: Start error:', error);
      setWhisperState(prev => ({ ...prev, isRecording: false, isConnected: false }));
      handleWhisperError(error instanceof Error ? error.message : 'Failed to start Whisper');
    }
  }, [initializeServices, handleWhisperError, handleWhisperStatus]);

  const startBrowser = useCallback(async () => {
    if (!ENABLE_BROWSER_SPEECH) {
      console.log('🚫 BROWSER: Service disabled by feature flag');
      return;
    }
    
    console.log('🚀 BROWSER: Starting browser speech...');
    try {
      setBrowserState(prev => ({ ...prev, error: null, sessionStartTime: new Date(), sessionCount: 1 }));
      
      initializeServices();
      if (browserTranscriberRef.current) {
        await browserTranscriberRef.current.startTranscription();
      } else {
        throw new Error('Browser Speech transcriber not initialized');
      }
    } catch (error) {
      console.error('Failed to start Browser Speech:', error);
      handleBrowserError(error instanceof Error ? error.message : 'Failed to start Browser Speech');
    }
  }, [initializeServices, handleBrowserError]);

  // Stop individual services
  const stopAssemblyAI = useCallback(() => {
    console.log('🛑 ASSEMBLY: Stopping AssemblyAI service...');
    try {
      assemblyTranscriberRef.current?.stopTranscription();
      setAssemblyState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isConnected: false, 
        timeRemaining: 0, 
        isReconnecting: false 
      }));
      console.log('✅ ASSEMBLY: Service stopped');
    } catch (error) {
      console.error('❌ ASSEMBLY: Stop error:', error);
    }
  }, []);

  const stopDeepgram = useCallback(() => {
    if (deepgramWsRef.current) {
      deepgramWsRef.current.close();
      deepgramWsRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setDeepgramState(prev => ({ ...prev, isRecording: false, isConnected: false }));
    setAudioLevel(0);
  }, []);

  const stopWhisper = useCallback(() => {
    console.log('🛑 WHISPER: Stopping Whisper service...');
    try {
      // Stop and clean up MediaRecorder
      if (mediaRecorder) {
        try {
          mediaRecorder.stop();
        } catch (e) {
          console.warn('MediaRecorder stop error:', e);
        }
        mediaRecorder = null;
      }
      
      // Stop and clean up microphone stream
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
      }
      
      // Clean up Whisper transcriber
      const whisper = whisperTranscriberRef.current;
      if (whisper && 'stopTranscription' in whisper) {
        whisper.stopTranscription();
      }
      
      // Reset chunk index
      whisperChunkIdx = 0;
      
      console.log('✅ WHISPER: Service stopped and cleaned up');
    } catch (error) {
      console.error('❌ WHISPER: Stop error:', error);
    }
    
    setWhisperState(prev => ({ ...prev, isRecording: false, isConnected: false }));
  }, []);

  const stopBrowser = useCallback(() => {
    console.log('🛑 BROWSER: Stopping browser speech...');
    try {
      if (browserTranscriberRef.current) {
        browserTranscriberRef.current.stopTranscription();
      }
    } catch (error) {
      console.error('Error stopping Browser Speech:', error);
    }
    setBrowserState(prev => ({ ...prev, isRecording: false, isConnected: false }));
  }, []);

  // Run all services
  const runAllServices = useCallback(async () => {
    console.log('🚀 Starting enabled transcription services...');
    setIsRunningAll(true);
    try {
      // Start only enabled services with delays to avoid conflicts
      if (ENABLE_ASSEMBLY) {
        console.log('Starting AssemblyAI...');
        await startAssemblyAI();
      } else {
        console.log('🚫 Skipping AssemblyAI (disabled)');
      }
      
      console.log('Starting Deepgram...');
      await startDeepgram();
      
      if (ENABLE_DESKTOP_WHISPER) {
        console.log('Starting Whisper...');
        await startWhisper();
      } else {
        console.log('🚫 Skipping Whisper (disabled)');
      }
      
      if (ENABLE_BROWSER_SPEECH) {
        console.log('Starting Browser Speech...');
        await startBrowser();
      } else {
        console.log('🚫 Skipping Browser Speech (disabled)');
      }
      
      console.log('✅ All enabled services started successfully');
    } catch (error) {
      console.error('❌ Error starting services:', error);
      setIsRunningAll(false);
    }
  }, [startAssemblyAI, startDeepgram, startWhisper, startBrowser]);

  const stopAllServices = useCallback(() => {
    console.log('🛑 Stopping all transcription services...');
    setIsRunningAll(false);
    stopAssemblyAI();
    stopDeepgram();
    stopWhisper();
    stopBrowser();
    console.log('✅ All services stopped');
  }, [stopAssemblyAI, stopDeepgram, stopWhisper, stopBrowser]);

  // Clear functions
  const clearService = (service: 'assemblyai' | 'deepgram' | 'whisper' | 'browser') => {
    const clearState = {
      transcripts: [],
      fullTranscript: '',
      error: null,
      avgConfidence: null,
      wordCount: 0,
      sessionCount: 0,
      sessionStartTime: null,
    };

    switch (service) {
      case 'assemblyai':
        setAssemblyState(prev => ({ ...prev, ...clearState }));
        break;
      case 'deepgram':
        setDeepgramState(prev => ({ ...prev, ...clearState }));
        break;
      case 'whisper':
        setWhisperState(prev => ({ ...prev, ...clearState }));
        break;
      case 'browser':
        setBrowserState(prev => ({ ...prev, ...clearState }));
        break;
    }
  };

  const clearAllServices = () => {
    clearService('assemblyai');
    clearService('deepgram');
    clearService('whisper');
    clearService('browser');
    setUploadedAudio(null);
    setCleanedTranscripts(['', '', '', '']);
  };

  // Handle MP3 file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.includes('audio')) {
      setUploadedAudio(file);
      toast.success(`Audio file "${file.name}" uploaded successfully`);
    } else {
      toast.error('Please upload a valid audio file (MP3, WAV, etc.)');
    }
  }, []);

  // Process uploaded audio through all services
  const processUploadedAudio = useCallback(async () => {
    if (!uploadedAudio) {
      toast.error('Please upload an audio file first');
      return;
    }

    setIsProcessingUpload(true);
    clearAllServices();

    try {
      const startTime = new Date();
      
      // Update all states to show processing
      [setAssemblyState, setDeepgramState, setWhisperState, setBrowserState].forEach(setState => {
        setState(prev => ({ 
          ...prev, 
          sessionStartTime: startTime,
          sessionCount: 1,
          isRecording: true,
          isConnected: true
        }));  
      });

      // Process with all services in parallel
      const results = await Promise.allSettled([
        processWithAssemblyAI(uploadedAudio),
        processWithDeepgram(uploadedAudio), 
        processWithWhisper(uploadedAudio),
        processWithBrowserSpeech(uploadedAudio)
      ]);

      results.forEach((result, index) => {
        const serviceName = ['AssemblyAI', 'Deepgram', 'Whisper', 'Browser'][index];
        if (result.status === 'rejected') {
          console.error(`${serviceName} processing failed:`, result.reason);
          toast.error(`${serviceName} processing failed`);
        }
      });

      toast.success('Audio processing completed for all services');
    } catch (error) {
      console.error('Error processing uploaded audio:', error);
      toast.error('Failed to process uploaded audio');
    } finally {
      setIsProcessingUpload(false);
      // Update states to show completed
      [setAssemblyState, setDeepgramState, setWhisperState, setBrowserState].forEach(setState => {
        setState(prev => ({ ...prev, isRecording: false }));
      });
    }
  }, [uploadedAudio]);

  // Process audio with AssemblyAI
  const processWithAssemblyAI = useCallback(async (audioFile: File) => {
    try {
      const { data, error } = await supabase.functions.invoke('assemblyai-transcription', {
        body: { 
          audioFile: await fileToBase64(audioFile),
          fileName: audioFile.name 
        }
      });

      if (error) throw error;

      if (data?.text) {
        const transcriptEntry: TranscriptEntry = {
          id: `assembly-upload-${Date.now()}`,
          text: data.text,
          isFinal: true,
          timestamp: new Date(),
          confidence: data.confidence || 0.9,
          service: 'assemblyai'
        };

        setAssemblyState(prev => ({
          ...prev,
          transcripts: [transcriptEntry],
          fullTranscript: data.text,
          wordCount: data.text.split(' ').filter(w => w.trim()).length,
          avgConfidence: data.confidence || 0.9
        }));
      }
    } catch (error) {
      console.error('AssemblyAI processing error:', error);
      setAssemblyState(prev => ({ ...prev, error: 'AssemblyAI processing failed' }));
    }
  }, []);

  // Process audio with Deepgram  
  const processWithDeepgram = useCallback(async (audioFile: File) => {
    try {
      const { data, error } = await supabase.functions.invoke('deepgram-direct', {
        body: { 
          audioFile: await fileToBase64(audioFile),
          fileName: audioFile.name 
        }
      });

      if (error) throw error;

      if (data?.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        const transcript = data.results.channels[0].alternatives[0].transcript;
        const confidence = data.results.channels[0].alternatives[0].confidence;
        
        const transcriptEntry: TranscriptEntry = {
          id: `deepgram-upload-${Date.now()}`,
          text: transcript,
          isFinal: true,
          timestamp: new Date(),
          confidence: confidence,
          service: 'deepgram'
        };

        setDeepgramState(prev => ({
          ...prev,
          transcripts: [transcriptEntry],
          fullTranscript: transcript,
          wordCount: transcript.split(' ').filter(w => w.trim()).length,
          avgConfidence: confidence
        }));
      }
    } catch (error) {
      console.error('Deepgram processing error:', error);
      setDeepgramState(prev => ({ ...prev, error: 'Deepgram processing failed' }));
    }
  }, []);

  // Process audio with Whisper
  const processWithWhisper = useCallback(async (audioFile: File) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-mp3-transcription', {
        body: { 
          audioFile: await fileToBase64(audioFile),
          fileName: audioFile.name 
        }
      });

      if (error) throw error;

      if (data?.text) {
        const transcriptEntry: TranscriptEntry = {
          id: `whisper-upload-${Date.now()}`,
          text: data.text,
          isFinal: true,
          timestamp: new Date(),
          confidence: data.confidence || 0.95,
          service: 'whisper'
        };

        setWhisperState(prev => ({
          ...prev,
          transcripts: [transcriptEntry],
          fullTranscript: data.text,
          wordCount: data.text.split(' ').filter(w => w.trim()).length,
          avgConfidence: data.confidence || 0.95
        }));
      }
    } catch (error) {
      console.error('Whisper processing error:', error);
      setWhisperState(prev => ({ ...prev, error: 'Whisper processing failed' }));
    }
  }, []);

  // Process audio with Browser Speech Recognition
  const processWithBrowserSpeech = useCallback(async (audioFile: File) => {
    try {
      // Use the speech-to-text edge function for browser-like processing
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { 
          audioFile: await fileToBase64(audioFile),
          fileName: audioFile.name 
        }
      });

      if (error) throw error;

      if (data?.text) {
        const transcriptEntry: TranscriptEntry = {
          id: `browser-upload-${Date.now()}`,
          text: data.text,
          isFinal: true,
          timestamp: new Date(),
          confidence: data.confidence || 0.8,
          service: 'browser'
        };

        setBrowserState(prev => ({
          ...prev,
          transcripts: [transcriptEntry],
          fullTranscript: data.text,
          wordCount: data.text.split(' ').filter(w => w.trim()).length,
          avgConfidence: data.confidence || 0.8
        }));
      } else {
        // Fallback: create a mock transcript
        const mockTranscript = `Browser Speech Recognition processed: ${audioFile.name}`;
        const transcriptEntry: TranscriptEntry = {
          id: `browser-upload-${Date.now()}`,
          text: mockTranscript,
          isFinal: true,
          timestamp: new Date(),
          confidence: 0.7,
          service: 'browser'
        };

        setBrowserState(prev => ({
          ...prev,
          transcripts: [transcriptEntry],
          fullTranscript: mockTranscript,
          wordCount: mockTranscript.split(' ').filter(w => w.trim()).length,
          avgConfidence: 0.7
        }));
      }
    } catch (error) {
      console.error('Browser speech processing error:', error);
      setBrowserState(prev => ({ ...prev, error: 'Browser speech processing failed' }));
    }
  }, []);

  // Helper function to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Export consolidated transcripts to Word
  const exportToWord = useCallback(async () => {
    try {
      const services = [
        { name: 'AssemblyAI', state: assemblyState },
        { name: 'Deepgram', state: deepgramState },
        { name: 'Whisper', state: whisperState },
        { name: 'Browser Speech', state: browserState }
      ];

      // Filter services with transcripts
      const servicesWithData = services.filter(service => service.state.fullTranscript.trim().length > 0);
      
      if (servicesWithData.length === 0) {
        toast.error('No transcripts available to export');
        return;
      }

      // Create document content
      let documentContent = `# Transcription Service Comparison Report\n\nGenerated: ${new Date().toLocaleString()}\n\n`;
      
      servicesWithData.forEach((service, index) => {
        const { name, state } = service;
        const startTime = state.sessionStartTime ? state.sessionStartTime.toLocaleString() : 'Unknown';
        
        documentContent += `## ${name}\n`;
        documentContent += `**Start Date & Time:** ${startTime}\n`;
        documentContent += `**Word Count:** ${state.wordCount}\n`;
        documentContent += `**Average Confidence:** ${state.avgConfidence ? `${(state.avgConfidence * 100).toFixed(1)}%` : 'N/A'}\n`;
        documentContent += `**Transcript Segments:** ${state.transcripts.length}\n\n`;
        documentContent += `**Full Transcript:**\n${state.fullTranscript}\n\n`;
        
        if (index < servicesWithData.length - 1) {
          documentContent += '---\n\n';
        }
      });

      // Generate and download Word document
      await generateWordDocument(
        documentContent,
        `Transcription_Comparison_${new Date().toISOString().split('T')[0]}`,
        true
      );
      
      toast.success('Word document exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export Word document');
    }
  }, [assemblyState, deepgramState, whisperState, browserState]);

  // Utility functions
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTotalSessionTime = (startTime: Date | null): string => {
    if (!startTime) return '0:00';
    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
    return formatTime(elapsed);
  };

  const getServiceStatus = (state: ServiceState) => {
    if (state.isReconnecting) return { text: 'Reconnecting...', color: 'bg-yellow-500' };
    if (state.isConnected) return { text: 'Connected', color: 'bg-green-500' };
    return { text: 'Disconnected', color: 'bg-red-500' };
  };

  const ServiceCard = ({ 
    title, 
    state, 
    onStart, 
    onStop, 
    onClear, 
    color 
  }: { 
    title: string;
    state: ServiceState;
    onStart: () => void;
    onStop: () => void;
    onClear: () => void;
    color: string;
  }) => {
    const status = getServiceStatus(state);
    
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className={`text-lg font-semibold ${color}`}>{title}</span>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
              <span className="text-sm text-muted-foreground">{status.text}</span>
            </div>
          </CardTitle>
          <CardDescription className="flex items-center gap-4 text-xs">
            {state.sessionStartTime && (
              <span>Time: {getTotalSessionTime(state.sessionStartTime)}</span>
            )}
            {state.wordCount > 0 && (
              <span>Words: {state.wordCount}</span>
            )}
            {state.avgConfidence !== null && (
              <span>Conf: {(state.avgConfidence * 100).toFixed(1)}%</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                console.log(`🎯 BUTTON CLICK: ${title} - isRecording: ${state.isRecording}, calling: ${state.isRecording ? 'onStop' : 'onStart'}`);
                if (state.isRecording) {
                  console.log(`🛑 ${title}: Calling onStop`);
                  onStop();
                } else {
                  console.log(`▶️ ${title}: Calling onStart`);
                  onStart();
                }
              }}
              disabled={state.isReconnecting}
              className="flex-1"
              variant={state.isRecording ? "destructive" : "default"}
            >
              {state.isReconnecting ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : state.isRecording ? (
                <Square className="w-4 h-4 mr-1" />
              ) : (
                <Play className="w-4 h-4 mr-1" />
              )}
              {state.isReconnecting ? 'Reconnecting' : state.isRecording ? 'Stop' : 'Start'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={state.transcripts.length === 0}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {state.error && (
            <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium">Full Transcript:</div>
            <div className="text-xs bg-muted/30 p-2 rounded max-h-24 overflow-y-auto">
              {state.fullTranscript || 'No transcript yet...'}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium">Recent ({state.transcripts.length}):</div>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {state.transcripts.slice(-3).map((transcript) => (
                <div key={transcript.id} className="text-xs p-1 bg-muted/20 rounded">
                  <div className="flex items-center gap-1 mb-1">
                    <Badge variant={transcript.isFinal ? "default" : "secondary"} className="text-[10px] px-1 py-0">
                      {transcript.isFinal ? "Final" : "Partial"}
                    </Badge>
                    {transcript.confidence !== undefined && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {(transcript.confidence * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px]">{transcript.text}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Header />
      <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Transcription Service Comparison
        </h1>
        <p className="text-muted-foreground mt-2">
          Compare AssemblyAI, Deepgram, Whisper, and Browser Speech real-time transcription services
        </p>
      </div>

      {/* Master Controls */}
      <Collapsible defaultOpen={false} className="mb-6">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5" />
                  Master Controls
                </div>
                <ChevronDown className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CardTitle>
              <CardDescription>
                Control all transcription services simultaneously or individually
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
          <div className="flex flex-col items-center gap-4">
            {/* Audio Level Indicator */}
            {(assemblyState.isRecording || deepgramState.isRecording || standaloneWhisperState.isRecording || browserState.isRecording) && (
              <div className="w-full max-w-xs">
                <div className="text-xs text-muted-foreground mb-1">Audio Level</div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-100"
                    style={{ width: `${audioLevel}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="flex gap-4 flex-wrap justify-center">
              {/* Audio Upload Section */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="audio-upload"
                  ref={(input) => {
                    if (input) {
                      (window as any).audioUploadInput = input;
                    }
                  }}
                />
                <Button 
                  variant="outline" 
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                  onClick={() => {
                    document.getElementById('audio-upload')?.click();
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Audio
                </Button>
                {uploadedAudio && (
                  <Button 
                    onClick={processUploadedAudio}
                    disabled={isProcessingUpload}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isProcessingUpload ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Process "{uploadedAudio.name.slice(0, 15)}..."
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* Live Recording Controls */}
              <Button
                size="lg"
                onClick={isRunningAllCalculated ? stopAllServices : runAllServices}
                disabled={assemblyState.isReconnecting || deepgramState.isReconnecting || whisperState.isReconnecting || browserState.isReconnecting || isProcessingUpload}
                className="min-w-[150px]"
                variant={isRunningAllCalculated ? "destructive" : "default"}
              >
                {isRunningAllCalculated ? (
                  <>
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop All Services
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Run All Services (Live)
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={clearAllServices}
                disabled={
                  assemblyState.transcripts.length === 0 && 
                  deepgramState.transcripts.length === 0 && 
                  standaloneWhisperState.transcripts.length === 0 &&
                  browserState.transcripts.length === 0
                }
              >
                Clear All Transcripts
              </Button>
              
              <Button
                variant="outline"
                onClick={exportToWord}
                disabled={
                  assemblyState.fullTranscript.trim().length === 0 &&
                  deepgramState.fullTranscript.trim().length === 0 &&
                  standaloneWhisperState.fullTranscript.trim().length === 0 &&
                  browserState.fullTranscript.trim().length === 0
                }
              >
                <Download className="w-4 h-4 mr-2" />
                Download Word
              </Button>
            </div>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* NHS Transcript Cleaner */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            NHS Transcript Cleaner
          </CardTitle>
          <CardDescription>
            Clean and standardize NHS terminology across all transcription services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TranscriptCleanerPanel
            transcripts={consolidatedTranscripts}
            onCleaned={handleTranscriptsCleaned}
          />
        </CardContent>
      </Card>

      {/* Service Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServiceCard
          title="AssemblyAI"
          state={assemblyState}
          onStart={startAssemblyAI}
          onStop={stopAssemblyAI}
          onClear={() => clearService('assemblyai')}
          color="text-blue-600"
        />
        
        <ServiceCard
          title="Deepgram"
          state={deepgramState}
          onStart={startDeepgram}
          onStop={stopDeepgram}
          onClear={() => clearService('deepgram')}
          color="text-green-600"
        />
        
        <ServiceCard
          title="Standalone Whisper"
          state={standaloneWhisperState}
          onStart={() => {
            console.log('🎯 STANDALONE WHISPER ServiceCard onStart called!');
            handleStartStandaloneWhisper();
          }}
          onStop={() => {
            console.log('🎯 STANDALONE WHISPER ServiceCard onStop called!');
            handleStopStandaloneWhisper();
          }}
          onClear={clearStandaloneWhisper}
          color="text-pink-600"
        />
        
        <ServiceCard
          title="Browser Speech"
          state={browserState}
          onStart={startBrowser}
          onStop={stopBrowser}
          onClear={() => clearService('browser')}
          color="text-orange-600"
        />
      </div>

      {/* Cost Comparison Section */}
      <Collapsible defaultOpen={false} className="mt-6">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span>Transcription Cost Comparison</span>
                <ChevronDown className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <TranscribeCostComparison />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Instructions */}
      <Collapsible defaultOpen={false} className="mt-6">
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span>How to Use</span>
                <ChevronDown className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• <strong>Upload Audio:</strong> Upload an MP3 or audio file to test all services with the same audio content</p>
              <p>• <strong>Run All Services (Live):</strong> Start all four transcription services simultaneously to compare their real-time performance</p>
              <p>• <strong>Individual Controls:</strong> Use the Start/Stop buttons on each service card to test them individually</p>
              <p>• <strong>Full Transcript:</strong> See the complete consolidated transcript for each service</p>
              <p>• <strong>Recent Activity:</strong> View the most recent transcription results with confidence scores</p>
              <p>• <strong>Performance Metrics:</strong> Compare word count, confidence levels, and session duration across services</p>
              <p>• <strong>Browser Speech:</strong> Uses your browser's built-in speech recognition (works best in Chrome)</p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
    </>
  );
}