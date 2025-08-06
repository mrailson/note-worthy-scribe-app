import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, MicOff, Pause, Play, Square, Wifi, WifiOff, RotateCcw, Stethoscope } from 'lucide-react';
import { useGPScribeRecording } from '@/hooks/useGPScribeRecording';

interface GPScribeRecorderProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onRecordingComplete?: (consultationData: any) => void;
  consultationType?: 'face-to-face' | 'telephone' | 'video';
}

export const GPScribeRecorder: React.FC<GPScribeRecorderProps> = ({
  onTranscriptUpdate,
  onRecordingComplete,
  consultationType = 'face-to-face'
}) => {
  const {
    isRecording,
    isPaused,
    duration,
    transcript,
    connectionStatus,
    wordCount,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetSession,
    formatDuration,
    getConsultationData
  } = useGPScribeRecording();

  // Notify parent of transcript updates
  React.useEffect(() => {
    if (onTranscriptUpdate && transcript) {
      onTranscriptUpdate(transcript);
    }
  }, [transcript, onTranscriptUpdate]);

  // Handle recording completion
  const handleStopRecording = async () => {
    await stopRecording();
    
    if (onRecordingComplete) {
      const consultationData = getConsultationData();
      onRecordingComplete(consultationData);
    }
  };

  // Get connection status styling
  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'Recording consultation...':
      case 'Consultation transcribed':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'Setting up consultation audio capture...':
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
      case 'Recording consultation...':
      case 'Consultation transcribed':
        return 'default';
      case 'Setting up consultation audio capture...':
      case 'Connecting...':
        return 'secondary';
      case 'Error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getConsultationTypeIcon = () => {
    switch (consultationType) {
      case 'face-to-face':
        return <Stethoscope className="h-4 w-4" />;
      case 'telephone':
        return <Mic className="h-4 w-4" />;
      case 'video':
        return <Wifi className="h-4 w-4" />;
      default:
        return <Stethoscope className="h-4 w-4" />;
    }
  };

  return (
    <Card className="shadow-medium border-accent/20">
      <CardHeader className="pb-4">
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            {getConsultationTypeIcon()}
            GP Consultation Recorder
          </span>
          <div className="flex items-center gap-2">
            <Badge 
              variant={getConnectionStatusColor() as any} 
              className="flex items-center gap-1 text-xs"
            >
              {getConnectionStatusIcon()}
              <span className="hidden sm:inline">{connectionStatus}</span>
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {consultationType.replace('-', ' ')}
            </Badge>
            {(connectionStatus === "Disconnected" || connectionStatus === "Stopped") && (
              <Button
                onClick={resetSession}
                variant="outline"
                size="sm"
                className="text-xs px-3 py-1 h-6"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Recording Controls */}
        <div className="bg-gradient-to-br from-primary/5 to-accent/10 rounded-xl p-6 border border-primary/20 shadow-subtle">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            
            {/* Recording Stats */}
            <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{formatDuration()}</div>
                <div className="text-sm text-muted-foreground">Duration</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{wordCount}</div>
                <div className="text-sm text-muted-foreground">Words</div>
              </div>
              <div className="text-center col-span-2 lg:col-span-1">
                <div className="text-lg font-semibold text-accent">
                  {isRecording ? (isPaused ? 'Paused' : 'Recording') : 'Ready'}
                </div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </div>

            {/* Recording Controls */}
            <div className="flex items-center justify-center gap-3">
              {!isRecording ? (
                <Button 
                  onClick={startRecording}
                  className="shadow-elegant px-8 py-6 text-lg font-semibold min-h-[64px] rounded-xl transition-all duration-300 bg-gradient-primary hover:bg-primary-hover hover:shadow-glow hover:scale-105"
                >
                  <Mic className="h-6 w-6 mr-3" />
                  Start Consultation
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    variant="outline"
                    size="lg"
                    className="px-6 py-3"
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-5 w-5 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={handleStopRecording}
                    variant="destructive"
                    size="lg"
                    className="px-6 py-3"
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop & Generate Notes
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Transcript Preview */}
        {transcript && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-primary">Live Consultation Transcript</h4>
              <Badge variant="secondary" className="text-xs">
                {wordCount} words transcribed
              </Badge>
            </div>
            <div className="bg-secondary/30 rounded-lg p-4 max-h-40 overflow-y-auto">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {transcript || 'Transcript will appear here as you speak...'}
              </p>
            </div>
          </div>
        )}

        {/* Recording Tips for Consultations */}
        {!isRecording && (
          <div className="bg-accent/10 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-accent mb-2">Consultation Recording Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Ensure clear audio quality for accurate medical transcription</li>
              <li>• Speak clearly when discussing symptoms, medications, or procedures</li>
              <li>• Record for at least 30 seconds for meaningful consultation notes</li>
              <li>• The system is optimized for medical terminology and abbreviations</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};