import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Square, Clock, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";

interface AudioControlsProps {
  isRecording: boolean;
  duration: string;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const AudioControls = ({
  isRecording,
  duration,
  connectionStatus,
  onStartRecording,
  onStopRecording
}: AudioControlsProps) => {
  
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const statusConfig = {
      'connected': { variant: 'default' as const, label: 'Connected' },
      'connecting': { variant: 'secondary' as const, label: 'Connecting...' },
      'error': { variant: 'destructive' as const, label: 'Connection Error' },
      'disconnected': { variant: 'outline' as const, label: 'Disconnected' }
    };
    
    const config = statusConfig[connectionStatus];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card className="shadow-medium">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Meeting Recorder
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Recording Status */}
        <div className="text-center space-y-4">
          {isRecording && <NotewellAIAnimation isVisible={true} />}
          
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-lg font-mono font-semibold">{duration}</span>
            </div>
            
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-muted-foreground">Recording</span>
              </div>
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <Button
              onClick={onStartRecording}
              size="lg"
              className="bg-gradient-primary hover:bg-primary-hover text-white shadow-medium transition-all touch-manipulation min-h-[56px] px-8"
              disabled={connectionStatus === 'error'}
            >
              <Mic className="h-5 w-5 mr-2" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={onStopRecording}
              size="lg"
              variant="destructive"
              className="shadow-medium transition-all touch-manipulation min-h-[56px] px-8"
            >
              <Square className="h-5 w-5 mr-2" />
              Stop Recording
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {connectionStatus === 'error' && (
          <div className="text-center text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mx-auto mb-1" />
            Please check your microphone permissions and try again
          </div>
        )}

        {connectionStatus === 'connecting' && (
          <div className="text-center text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-1"></div>
            Connecting to audio services...
          </div>
        )}

        {!isRecording && connectionStatus === 'disconnected' && (
          <div className="text-center text-sm text-muted-foreground">
            Click "Start Recording" to begin capturing your meeting
          </div>
        )}
      </CardContent>
    </Card>
  );
};