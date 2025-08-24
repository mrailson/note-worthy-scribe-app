import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Mic, 
  MicOff, 
  Square, 
  RotateCcw, 
  Wifi, 
  WifiOff, 
  Loader2,
  AlertTriangle,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { OpenAIRealtimeTranscriber, ConnectionStatus, TranscriptData } from '@/utils/OpenAIRealtimeTranscriber';

interface OpenAIRealtimeTranscriptionProps {
  onTranscription: (text: string, isPartial?: boolean) => void;
  onFinalTranscription?: (text: string) => void;
  className?: string;
  autoStart?: boolean;
}

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English (UK)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

export const OpenAIRealtimeTranscription: React.FC<OpenAIRealtimeTranscriptionProps> = ({
  onTranscription,
  onFinalTranscription,
  className = '',
  autoStart = false
}) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState('en');
  const [medicalBias, setMedicalBias] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [finalTranscripts, setFinalTranscripts] = useState<string[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  
  const transcriberRef = useRef<OpenAIRealtimeTranscriber | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<number | null>(null);

  const handleTranscription = useCallback((data: TranscriptData) => {
    if (data.isFinal) {
      setFinalTranscripts(prev => {
        const newTranscripts = [...prev, data.text];
        onFinalTranscription?.(newTranscripts.join(' '));
        return newTranscripts;
      });
      setPartialText('');
      onTranscription(data.text, false);
    } else {
      setPartialText(data.text);
      onTranscription(data.text, true);
    }
  }, [onTranscription, onFinalTranscription]);

  const handleError = useCallback((error: string) => {
    console.error('Transcription error:', error);
    setError(error);
    toast.error(`Transcription error: ${error}`);
  }, []);

  const handleStatusChange = useCallback((status: ConnectionStatus, latencyMs?: number) => {
    setConnectionStatus(status);
    if (latencyMs !== undefined) {
      setLatency(latencyMs);
    }
    
    switch (status) {
      case 'connecting':
        toast.info('Connecting to transcription service...');
        break;
      case 'connected':
        toast.success('Connected to transcription service');
        break;
      case 'live':
        if (!isRecording) {
          setIsRecording(true);
          toast.success('Live transcription started');
        }
        break;
      case 'disconnected':
        setIsRecording(false);
        toast.info('Transcription disconnected');
        break;
      case 'error':
        setIsRecording(false);
        break;
    }
  }, [isRecording]);

  const startTranscription = useCallback(async () => {
    try {
      setError(null);
      
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }

      transcriberRef.current = new OpenAIRealtimeTranscriber(
        handleTranscription,
        handleError,
        handleStatusChange
      );

      await transcriberRef.current.startTranscription(language, medicalBias);
      
    } catch (error) {
      console.error('Failed to start transcription:', error);
      const message = error instanceof Error ? error.message : 'Failed to start transcription';
      setError(message);
      toast.error(message);
    }
  }, [language, medicalBias, handleTranscription, handleError, handleStatusChange]);

  const stopTranscription = useCallback(() => {
    if (transcriberRef.current) {
      transcriberRef.current.stopTranscription();
      transcriberRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const resetTranscription = useCallback(() => {
    setPartialText('');
    setFinalTranscripts([]);
    setLatency(null);
    setError(null);
    toast.info('Transcript cleared');
  }, []);

  const handleScroll = useCallback(() => {
    setIsUserScrolling(true);
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsUserScrolling(false);
    }, 2000);
  }, []);

  // Auto-scroll to bottom when new content is added (unless user is scrolling)
  useEffect(() => {
    if (!isUserScrolling && scrollAreaRef.current && (partialText || finalTranscripts.length > 0)) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [partialText, finalTranscripts, isUserScrolling]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !isRecording && connectionStatus === 'disconnected') {
      startTranscription();
    }
  }, [autoStart, isRecording, connectionStatus, startTranscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transcriberRef.current) {
        transcriberRef.current.stopTranscription();
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'connected':
      case 'live':
        return <Wifi className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <WifiOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting';
      case 'connected':
        return 'Connected';
      case 'live':
        return 'Live';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  const getStatusVariant = () => {
    switch (connectionStatus) {
      case 'live':
        return 'default' as const;
      case 'connected':
        return 'secondary' as const;
      case 'connecting':
        return 'outline' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              OpenAI Realtime Transcription
            </CardTitle>
            <CardDescription>
              Real-time speech-to-text with streaming partial results
            </CardDescription>
          </div>
          
          {/* Status and Controls */}
          <div className="flex items-center gap-2">
            {latency && (
              <Badge variant="outline" className="text-xs">
                {latency}ms
              </Badge>
            )}
            
            <Badge variant={getStatusVariant()} className="flex items-center gap-1">
              {getStatusIcon()}
              {getStatusText()}
            </Badge>
            
            <div className="flex gap-1">
              <Button
                variant={isRecording ? "default" : "outline"}
                size="sm"
                onClick={isRecording ? stopTranscription : startTranscription}
                disabled={connectionStatus === 'connecting'}
                className="gap-2"
              >
                {connectionStatus === 'connecting' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <Square className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {isRecording ? 'Stop' : 'Start'}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={resetTranscription}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select value={language} onValueChange={setLanguage} disabled={isRecording}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="medical-bias"
              checked={medicalBias}
              onCheckedChange={setMedicalBias}
              disabled={isRecording}
            />
            <Label htmlFor="medical-bias">Medical bias</Label>
          </div>
        </div>
        
        {/* Safety Banner */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>NHS Privacy Notice:</strong> No patient identifiers in test data. This is a pilot feature for healthcare professionals.
          </AlertDescription>
        </Alert>
        
        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}
        
        <Separator />
        
        {/* Transcript Display */}
        <div className="space-y-3">
          {/* Partial Results */}
          {partialText && (
            <div className="min-h-8 p-3 rounded-md bg-muted/50 border-2 border-dashed border-muted-foreground/20">
              <div className="text-sm text-muted-foreground font-mono italic">
                {partialText}
                <span className="animate-pulse ml-1">|</span>
              </div>
            </div>
          )}
          
          {/* Final Transcripts */}
          {finalTranscripts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Final Transcript</Label>
              <div
                ref={scrollAreaRef}
                onScroll={handleScroll}
                className="max-h-64 overflow-y-auto p-4 rounded-md bg-background border font-mono text-sm space-y-2 select-text"
              >
                {finalTranscripts.map((transcript, index) => (
                  <div key={index} className="leading-relaxed">
                    {transcript}
                  </div>
                ))}
                
                {isUserScrolling && finalTranscripts.length > 3 && (
                  <div className="sticky bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-1 text-center">
                    <Badge variant="outline" className="text-xs">
                      Auto-scroll paused
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Empty State */}
          {!partialText && finalTranscripts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Click Start to begin real-time transcription</p>
              <p className="text-xs">Partial results appear immediately, final text is saved below</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};