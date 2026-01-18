import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsultationType, CONSULTATION_TYPE_LABELS, ScribeTranscriptData, PatientContext, ConsultationContextFile } from "@/types/scribe";
import { PatientContextBanner } from "./PatientContextBanner";
import { SoFarReviewPanel } from "./SoFarReviewPanel";
import { ContextUploadPanel } from "./ContextUploadPanel";
import { MinimalRecordingState } from "./MinimalRecordingState";
import { AudioWaveform } from "./AudioWaveform";
import { LiveTranscriptPreview } from "./LiveTranscriptPreview";
import { QuickAudioSourceSwitcher, AudioSourceMode } from "@/components/meeting/QuickAudioSourceSwitcher";
import { PreviewStatus } from "@/hooks/useScribeRecording";
import { Mic, Pause, Play, Square, Eye, EyeOff, Clock, FileText, Brain, Paperclip, Loader2, Minimize2, BarChart3, CheckCircle, XCircle, AlertCircle, Trash2, Radio } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { ChunkStatus } from "@/hooks/useChunkTracker";

interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

interface ChunkStats {
  total: number;
  successful: number;
  lowConfidence: number;
  filtered: number;
  totalWords: number;
  avgConfidence: number;
  successRate: number;
}

interface ConsultationRecordingStateProps {
  duration: number;
  wordCount: number;
  connectionStatus: string;
  consultationType: ConsultationType;
  isPaused: boolean;
  isFinishing?: boolean;
  transcript: string;
  realtimeTranscripts: ScribeTranscriptData[];
  showLiveTranscript: boolean;
  patientContext: PatientContext | null;
  showPatientBanner: boolean;
  contextFiles: ConsultationContextFile[];
  minimalRecordingView: boolean;
  formatDuration: (seconds: number) => string;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onClearPatientContext?: () => void;
  onAddContextFile: (file: ConsultationContextFile) => void;
  onRemoveContextFile: (fileId: string) => void;
  // Audio source switching props
  audioSourceMode?: AudioSourceMode;
  onAudioSourceChange?: (mode: AudioSourceMode) => Promise<void>;
  isSwitchingAudioSource?: boolean;
  micCaptured?: boolean;
  systemAudioCaptured?: boolean;
  // Chunk tracking props
  chunks?: ChunkStatus[];
  chunkStats?: ChunkStats;
  onClearChunks?: () => void;
  // Live preview props (AssemblyAI real-time for mic verification)
  livePreviewTranscript?: string;
  livePreviewFullTranscript?: string;
  livePreviewStatus?: PreviewStatus;
  livePreviewActive?: boolean;
  livePreviewError?: string | null;
}

interface TimestampedSegment {
  text: string;
  timestamp: Date;
  elapsedSeconds: number;
  isFinal: boolean;
}

export const ConsultationRecordingState = ({
  duration,
  wordCount,
  connectionStatus,
  consultationType,
  isPaused,
  isFinishing = false,
  transcript,
  realtimeTranscripts,
  showLiveTranscript: initialShowTranscript,
  patientContext,
  showPatientBanner,
  contextFiles,
  minimalRecordingView,
  formatDuration,
  onPause,
  onResume,
  onFinish,
  onCancel,
  onClearPatientContext,
  onAddContextFile,
  onRemoveContextFile,
  // Audio source props with defaults
  audioSourceMode = 'microphone',
  onAudioSourceChange,
  isSwitchingAudioSource = false,
  micCaptured = false,
  systemAudioCaptured = false,
  // Chunk tracking props
  chunks = [],
  chunkStats,
  onClearChunks,
  // Live preview props
  livePreviewTranscript = '',
  livePreviewFullTranscript = '',
  livePreviewStatus = 'idle',
  livePreviewActive = false,
  livePreviewError = null
}: ConsultationRecordingStateProps) => {
  const isMobile = useIsMobile();
  const [showTranscript, setShowTranscript] = useState(initialShowTranscript);
  const [startTime] = useState(() => new Date());
  const [timestampedSegments, setTimestampedSegments] = useState<TimestampedSegment[]>([]);
  const [activeTab, setActiveTab] = useState<string>("transcript");
  const [showMinimalView, setShowMinimalView] = useState(minimalRecordingView);
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const chunksScrollRef = useRef<HTMLDivElement>(null);
  const lastTranscriptCount = useRef(0);

  // Load available microphones
  useEffect(() => {
    const loadMicrophones = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mics = devices
          .filter(device => device.kind === 'audioinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Microphone ${index + 1}`,
          }));
        setMicrophones(mics);
        if (mics.length > 0 && !selectedMicId) {
          setSelectedMicId(mics[0].deviceId);
        }
      } catch (error) {
        console.error('Failed to enumerate devices:', error);
      }
    };

    loadMicrophones();
    
    navigator.mediaDevices.addEventListener('devicechange', loadMicrophones);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadMicrophones);
    };
  }, [selectedMicId]);

  // Track new transcripts and add timestamps
  useEffect(() => {
    if (realtimeTranscripts.length > lastTranscriptCount.current) {
      const newTranscripts = realtimeTranscripts.slice(lastTranscriptCount.current);
      const newSegments: TimestampedSegment[] = newTranscripts.map((t) => ({
        text: t.text,
        timestamp: new Date(),
        elapsedSeconds: duration,
        isFinal: t.isFinal
      }));
      
      setTimestampedSegments(prev => [...prev, ...newSegments]);
      lastTranscriptCount.current = realtimeTranscripts.length;
    }
  }, [realtimeTranscripts, duration]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [timestampedSegments]);

  // Format elapsed time as MM:SS
  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Group consecutive segments within 5 seconds
  const groupedSegments = timestampedSegments.reduce<TimestampedSegment[][]>((acc, segment) => {
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && Math.abs(segment.elapsedSeconds - lastGroup[0].elapsedSeconds) < 5) {
      lastGroup.push(segment);
    } else {
      acc.push([segment]);
    }
    return acc;
  }, []);

  // Show minimal view if enabled
  if (showMinimalView) {
    return (
      <MinimalRecordingState
        duration={duration}
        wordCount={wordCount}
        isPaused={isPaused}
        formatDuration={formatDuration}
        onPause={onPause}
        onResume={onResume}
        onFinish={onFinish}
        onExpandView={() => setShowMinimalView(false)}
        transcript={transcript}
        selectedMicrophoneId={selectedMicId}
        onMicrophoneChange={setSelectedMicId}
        audioSourceMode={audioSourceMode}
        onAudioSourceChange={onAudioSourceChange}
        isSwitchingAudioSource={isSwitchingAudioSource}
        micCaptured={micCaptured}
        systemAudioCaptured={systemAudioCaptured}
      />
    );
  }

  return (
    <>
      {/* Full-screen finishing overlay - shows immediately when finish is clicked */}
      {isFinishing && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4 border-primary/20">
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Finishing Consultation</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Processing final transcript...
                </p>
              </div>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(duration)}
                </span>
                <span>•</span>
                <span>{wordCount} words</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-180px)] px-2 sm:px-4">
      {/* Patient Context Banner */}
      {patientContext && showPatientBanner && (
        <div className="mb-3">
          <PatientContextBanner 
            patientContext={patientContext} 
            onClear={onClearPatientContext}
            compact 
          />
        </div>
      )}

      {/* Header with Recording Status */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          {/* Recording Indicator */}
          <div className="flex items-center gap-2">
            <div className={`
              w-3 h-3 rounded-full 
              ${isPaused 
                ? 'bg-amber-500' 
                : 'bg-destructive animate-pulse'
              }
            `} />
            <span className="font-mono text-lg font-semibold">
              {formatDuration(duration)}
            </span>
          </div>
          
          {/* Connection Status */}
          <span className={`
            text-xs px-2 py-1 rounded-full
            ${connectionStatus === 'Connected' 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            }
          `}>
            {connectionStatus}
          </span>
          
          {/* Audio Waveform */}
          {!isPaused && connectionStatus === 'Connected' && (
            <AudioWaveform 
              deviceId={selectedMicId} 
              isActive={!isPaused}
              barCount={5}
            />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Audio Source Switcher */}
          {onAudioSourceChange && (
            <QuickAudioSourceSwitcher
              currentMode={audioSourceMode}
              onModeChange={onAudioSourceChange}
              isRecording={true}
              isSwitching={isSwitchingAudioSource}
              micCaptured={micCaptured}
              systemAudioCaptured={systemAudioCaptured}
              disabled={isFinishing}
            />
          )}
          
          {/* Microphone Selector */}
          {microphones.length > 0 && (
            <Select value={selectedMicId} onValueChange={setSelectedMicId}>
              <SelectTrigger className="w-auto max-w-[300px] h-8 text-xs bg-background">
                <Mic className="h-3 w-3 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Select mic" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50 max-w-[400px]">
                {microphones.map((mic) => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId} className="text-xs">
                    {mic.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <span className="text-sm text-muted-foreground">
            {CONSULTATION_TYPE_LABELS[consultationType]}
          </span>
          <span className="text-sm text-muted-foreground">
            • {wordCount} words
          </span>
          
          {/* Minimal View Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMinimalView(true)}
            className="h-8 gap-1.5 text-xs"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Minimal View</span>
          </Button>
        </div>
      </div>

      {/* Live Preview - AssemblyAI real-time for mic verification */}
      <LiveTranscriptPreview
        transcript={livePreviewTranscript}
        status={livePreviewStatus}
        isActive={livePreviewActive}
        error={livePreviewError}
        className="mb-3"
      />

      {/* Session Info Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b mb-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Started: {format(startTime, 'HH:mm')}
          </span>
          <span>
            {format(startTime, 'EEEE, d MMMM yyyy')}
          </span>
        </div>
      </div>

      {/* Tabbed Content Area */}
      <div className="flex-1 min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className={`grid w-full grid-cols-5 mb-3 ${isMobile ? 'h-12' : ''}`}>
            <TabsTrigger value="transcript" className={`touch-manipulation ${isMobile ? 'flex-col py-1.5 gap-0.5' : 'gap-2'}`}>
              <FileText className={isMobile ? "h-4 w-4" : "h-4 w-4"} />
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Transcript</span>
            </TabsTrigger>
            <TabsTrigger value="sofar" className={`touch-manipulation ${isMobile ? 'flex-col py-1.5 gap-0.5' : 'gap-2'}`}>
              <Brain className={isMobile ? "h-4 w-4" : "h-4 w-4"} />
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>So Far</span>
            </TabsTrigger>
            <TabsTrigger value="assemblyai" className={`touch-manipulation relative ${isMobile ? 'flex-col py-1.5 gap-0.5' : 'gap-2'}`}>
              <Radio className={isMobile ? "h-4 w-4" : "h-4 w-4"} />
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Real-time</span>
              {livePreviewActive && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="chunks" className={`touch-manipulation relative ${isMobile ? 'flex-col py-1.5 gap-0.5' : 'gap-2'}`}>
              <BarChart3 className={isMobile ? "h-4 w-4" : "h-4 w-4"} />
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Chunks</span>
              {chunks.length > 0 && (
                <Badge variant="secondary" className={`h-5 px-1.5 text-xs ${isMobile ? 'absolute -top-1 -right-1' : 'ml-1'}`}>
                  {chunks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="context" className={`touch-manipulation relative ${isMobile ? 'flex-col py-1.5 gap-0.5' : 'gap-2'}`}>
              <Paperclip className={isMobile ? "h-4 w-4" : "h-4 w-4"} />
              <span className={isMobile ? "text-xs" : "hidden sm:inline"}>Context</span>
              {contextFiles.length > 0 && (
                <Badge variant="secondary" className={`h-5 px-1.5 text-xs ${isMobile ? 'absolute -top-1 -right-1' : 'ml-1'}`}>
                  {contextFiles.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Transcript Tab */}
          <TabsContent value="transcript" className="flex-1 min-h-0 mt-0">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-muted-foreground gap-2"
                >
                  {showTranscript ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
                </Button>
              </div>

              {showTranscript && (
                <Card className="flex-1 min-h-0">
                  <CardContent className="p-0 h-full">
                    <ScrollArea className="h-full">
                      <div ref={scrollRef} className="p-4 space-y-4">
                        {groupedSegments.length > 0 ? (
                          groupedSegments.map((group, groupIdx) => (
                            <div key={groupIdx} className="flex gap-3">
                              {/* Timestamp Column */}
                              <div className="flex-shrink-0 w-16 pt-0.5">
                                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {formatElapsed(group[0].elapsedSeconds)}
                                </span>
                              </div>
                              
                              {/* Text Column */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-relaxed">
                                  {group.map((segment, segIdx) => (
                                    <span
                                      key={segIdx}
                                      className={segment.isFinal ? 'text-foreground' : 'text-muted-foreground italic'}
                                    >
                                      {segment.text}{' '}
                                    </span>
                                  ))}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : transcript ? (
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 w-16 pt-0.5">
                              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                00:00
                              </span>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                {transcript}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                              <Mic className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3 animate-pulse" />
                              <p className="text-muted-foreground text-sm">
                                Listening... Start speaking and the transcript will appear here.
                              </p>
                              <p className="text-muted-foreground/70 text-xs mt-1">
                                Timestamps will be added automatically
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {!showTranscript && (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <div className={`
                      w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4
                      ${isPaused 
                        ? 'bg-amber-100 dark:bg-amber-900/30' 
                        : 'bg-destructive/10'
                      }
                    `}>
                      {isPaused ? (
                        <Pause className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Mic className="h-8 w-8 text-destructive animate-pulse" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isPaused ? 'Recording paused' : 'Recording in progress...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* So Far Tab */}
          <TabsContent value="sofar" className="flex-1 min-h-0 mt-0">
            <Card className="h-full">
              <SoFarReviewPanel 
                transcript={transcript}
                contextFiles={contextFiles}
              />
            </Card>
          </TabsContent>

          {/* AssemblyAI Real-time Tab */}
          <TabsContent value="assemblyai" className="flex-1 min-h-0 mt-0">
            <Card className="h-full">
              <CardContent className="p-4 h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">AssemblyAI Real-time Transcript</h3>
                    {livePreviewActive && (
                      <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700 text-xs">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        Live
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{livePreviewFullTranscript.split(/\s+/).filter(w => w.length > 0).length} words</span>
                  </div>
                </div>
                
                {/* Transcript Content */}
                <ScrollArea className="flex-1">
                  <div className="pr-4">
                    {livePreviewError ? (
                      <div className="flex items-center gap-2 text-destructive text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {livePreviewError}
                      </div>
                    ) : livePreviewFullTranscript ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {livePreviewFullTranscript}
                        {livePreviewActive && (
                          <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse" />
                        )}
                      </p>
                    ) : livePreviewActive ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Mic className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3 animate-pulse" />
                          <p className="text-muted-foreground text-sm">
                            Listening... Start speaking to see real-time transcription.
                          </p>
                          <p className="text-muted-foreground/70 text-xs mt-1">
                            AssemblyAI provides ~200ms latency transcription
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center text-muted-foreground">
                          <Radio className="h-8 w-8 mx-auto mb-3 opacity-50" />
                          <p className="text-sm">Real-time transcription not active</p>
                          <p className="text-xs mt-1">Starts automatically when recording begins</p>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Footer */}
                <div className="pt-3 mt-3 border-t text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Separate from Whisper batch transcription — for real-time feedback
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Chunks Debug Tab */}
          <TabsContent value="chunks" className="flex-1 min-h-0 mt-0">
            <Card className="h-full">
              <CardContent className="p-4 h-full flex flex-col">
                {/* Stats Overview */}
                {chunkStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-2xl font-bold">{chunkStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total Chunks</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-2 text-center">
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {chunkStats.successRate.toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Success Rate</p>
                    </div>
                    <div className="bg-blue-500/10 rounded-lg p-2 text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {(chunkStats.avgConfidence * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Confidence</p>
                    </div>
                    <div className="bg-red-500/10 rounded-lg p-2 text-center">
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {chunkStats.filtered}
                      </p>
                      <p className="text-xs text-muted-foreground">Filtered</p>
                    </div>
                  </div>
                )}

                {/* Clear Button */}
                {chunks.length > 0 && onClearChunks && (
                  <div className="flex justify-end mb-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClearChunks}
                      className="text-muted-foreground gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear All
                    </Button>
                  </div>
                )}

                {/* Chunks Timeline */}
                <ScrollArea className="flex-1">
                  <div ref={chunksScrollRef} className="space-y-2 pr-2">
                    {chunks.length === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <BarChart3 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground text-sm">
                            No chunks processed yet
                          </p>
                          <p className="text-muted-foreground/70 text-xs mt-1">
                            Chunks will appear as audio is transcribed
                          </p>
                        </div>
                      </div>
                    ) : (
                      [...chunks].reverse().map((chunk) => (
                        <div
                          key={chunk.id}
                          className={`
                            p-3 rounded-lg border text-sm
                            ${chunk.status === 'success' 
                              ? 'bg-green-500/5 border-green-500/20' 
                              : chunk.status === 'low_confidence'
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-red-500/5 border-red-500/20'
                            }
                          `}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {chunk.status === 'success' ? (
                                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                              ) : chunk.status === 'low_confidence' ? (
                                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                              )}
                              {/* Chunk timing: start - end seconds */}
                              {(chunk.startTimeSeconds !== undefined || chunk.endTimeSeconds !== undefined) && (
                                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {formatElapsed(chunk.startTimeSeconds ?? 0)} → {formatElapsed(chunk.endTimeSeconds ?? 0)}
                                </span>
                              )}
                              <Badge 
                                variant={chunk.status === 'success' ? 'default' : chunk.status === 'low_confidence' ? 'secondary' : 'destructive'}
                                className="text-xs"
                              >
                                {chunk.status === 'success' ? 'Success' : chunk.status === 'low_confidence' ? 'Low Confidence' : 'Filtered'}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {(chunk.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                          
                          {chunk.text && (
                            <p className="text-xs text-foreground/80 line-clamp-2 mt-1">
                              {chunk.text}
                            </p>
                          )}
                          
                          {chunk.reason && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 italic">
                              {chunk.reason}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span>{chunk.wordCount} words</span>
                            {/* File size */}
                            {chunk.audioSizeBytes !== undefined && (
                              <span className="flex items-center gap-1">
                                📦 {(chunk.audioSizeBytes / 1024).toFixed(1)}KB
                              </span>
                            )}
                            {/* MIME type */}
                            {chunk.mimeType && (
                              <span className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">
                                {chunk.mimeType.replace('audio/', '')}
                              </span>
                            )}
                            {/* Processing time */}
                            {chunk.processingTimeMs !== undefined && (
                              <span>⏱️ {chunk.processingTimeMs}ms</span>
                            )}
                            {chunk.speaker && <span>Speaker: {chunk.speaker}</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Context Tab */}
          <TabsContent value="context" className="flex-1 min-h-0 mt-0">
            <Card className="h-full">
              <ContextUploadPanel
                files={contextFiles}
                onAddFile={onAddContextFile}
                onRemoveFile={onRemoveContextFile}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom Action Bar */}
      <div className={`
        py-4 border-t bg-background/95 backdrop-blur-sm
        ${isMobile ? 'fixed bottom-0 left-0 right-0 px-4 pb-safe' : ''}
      `}>
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
            disabled={isFinishing}
          >
            Cancel
          </Button>
          
          <Button
            variant="outline"
            onClick={isPaused ? onResume : onPause}
            className="w-12 h-12 p-0 rounded-full"
            disabled={isFinishing}
          >
            {isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>
          
          <Button
            onClick={onFinish}
            disabled={isFinishing}
            className="flex-1 gap-2 bg-primary hover:bg-primary/90"
          >
            {isFinishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ending Consultation...
              </>
            ) : (
              <>
                <Square className="h-4 w-4" />
                Finish & Create Note
              </>
            )}
          </Button>
        </div>
      </div>
      </div>
    </>
  );
};
