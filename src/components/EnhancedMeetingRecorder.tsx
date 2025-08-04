import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mic, MicOff, Square, Clock, Wifi, WifiOff, AlertCircle, Download, Copy, Pause, Play, Settings } from "lucide-react";
import { toast } from "sonner";
import { useEnhancedMeetingRecorder, UseEnhancedMeetingRecorderOptions } from "@/hooks/useEnhancedMeetingRecorder";
import { NotewellAIAnimation } from "@/components/NotewellAIAnimation";
import { MeetingSettings } from "@/components/MeetingSettings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface EnhancedMeetingRecorderProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onDurationUpdate?: (duration: string) => void;
  onWordCountUpdate?: (count: number) => void;
  initialSettings?: {
    title: string;
    description: string;
    meetingType: string;
  };
}

export const EnhancedMeetingRecorder: React.FC<EnhancedMeetingRecorderProps> = ({
  onTranscriptUpdate,
  onDurationUpdate,
  onWordCountUpdate,
  initialSettings
}) => {
  const [enableSystemAudio, setEnableSystemAudio] = React.useState(false);
  const [contextPrompt, setContextPrompt] = React.useState(
    'This is a professional meeting transcription. Please transcribe accurately with proper punctuation and formatting.'
  );

  const options: UseEnhancedMeetingRecorderOptions = {
    initialSettings,
    onTranscriptUpdate,
    onDurationUpdate,
    onWordCountUpdate,
    contextPrompt,
    enableSystemAudio,
    onChunkProcessed: (result) => {
      console.log('Chunk processed:', result);
    }
  };

  const {
    isRecording,
    duration,
    transcript,
    wordCount,
    connectionStatus,
    chunksProcessed,
    transcriptionResults,
    formattedDuration,
    meetingSettings,
    sessionInfo,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    updateSettings,
    getCombinedTranscript
  } = useEnhancedMeetingRecorder(options);

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
      'connecting': { variant: 'secondary' as const, label: 'Processing...' },
      'error': { variant: 'destructive' as const, label: 'Error' },
      'disconnected': { variant: 'outline' as const, label: 'Ready' }
    };
    
    const config = statusConfig[connectionStatus];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      toast.success('Transcript copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy transcript');
    }
  };

  const handleDownloadTranscript = () => {
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-transcript-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Transcript downloaded');
  };

  const getProcessingProgress = () => {
    if (chunksProcessed === 0) return 0;
    const successfulChunks = transcriptionResults.filter(r => !r.error && !r.skipped).length;
    return (successfulChunks / chunksProcessed) * 100;
  };

  const getEstimatedReadingTime = () => {
    const wordsPerMinute = 200;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Tabs defaultValue="recorder" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="recorder">Recorder</TabsTrigger>
          <TabsTrigger value="transcript">Live Transcript</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="recorder" className="space-y-4">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  Enhanced Meeting Recorder
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
                    <span className="text-lg font-mono font-semibold">{formattedDuration}</span>
                  </div>
                  
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-muted-foreground">Recording</span>
                    </div>
                  )}
                </div>

                {/* Processing Stats */}
                {isRecording && chunksProcessed > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Chunks processed: {chunksProcessed} | Words: {wordCount}
                    </div>
                    <Progress value={getProcessingProgress()} className="w-full" />
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="flex justify-center gap-4">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    size="lg"
                    className="bg-gradient-primary hover:bg-primary-hover text-white shadow-medium transition-all touch-manipulation min-h-[56px] px-8"
                    disabled={connectionStatus === 'error'}
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    Start Enhanced Recording
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={pauseRecording}
                      size="lg"
                      variant="outline"
                      className="shadow-medium transition-all touch-manipulation min-h-[56px] px-6"
                    >
                      <Pause className="h-5 w-5 mr-2" />
                      Pause
                    </Button>
                    <Button
                      onClick={stopRecording}
                      size="lg"
                      variant="destructive"
                      className="shadow-medium transition-all touch-manipulation min-h-[56px] px-6"
                    >
                      <Square className="h-5 w-5 mr-2" />
                      Stop Recording
                    </Button>
                  </div>
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
                  Starting enhanced audio processing...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcript" className="space-y-4">
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  Enhanced Live Transcript
                  {isRecording && <Badge variant="default">Live</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopyTranscript}
                    size="sm"
                    variant="outline"
                    disabled={!transcript}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                  <Button
                    onClick={handleDownloadTranscript}
                    size="sm"
                    variant="outline"
                    disabled={!transcript}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {/* Transcript Statistics */}
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <span>Words: {wordCount}</span>
                <span>Chunks: {chunksProcessed}</span>
                <span>Reading Time: ~{getEstimatedReadingTime()} min</span>
              </div>

              <ScrollArea className="h-96 w-full rounded-md border p-4">
                {transcript ? (
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {transcript}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Transcript will appear here as you speak</p>
                      <p className="text-xs mt-1">Enhanced processing with 15s chunks and 2s overlap</p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Meeting Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Meeting Title</Label>
                  <input
                    id="title"
                    type="text"
                    value={meetingSettings.title}
                    onChange={(e) => updateSettings({ title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={isRecording}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={meetingSettings.description}
                    onChange={(e) => updateSettings({ description: e.target.value })}
                    disabled={isRecording}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Enhanced Recording Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="system-audio"
                    checked={enableSystemAudio}
                    onCheckedChange={setEnableSystemAudio}
                    disabled={isRecording}
                  />
                  <Label htmlFor="system-audio">
                    Enable System Audio Capture
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Capture both microphone and system audio (requires screen sharing permission)
                </p>

                <div className="space-y-2">
                  <Label htmlFor="context-prompt">AI Context Prompt</Label>
                  <Textarea
                    id="context-prompt"
                    value={contextPrompt}
                    onChange={(e) => setContextPrompt(e.target.value)}
                    disabled={isRecording}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    This prompt helps guide the AI transcription for better accuracy
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Processing Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{transcriptionResults.length}</div>
                  <div className="text-sm text-muted-foreground">Total Chunks</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {transcriptionResults.filter(r => !r.error && !r.skipped).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Successful</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {transcriptionResults.filter(r => r.skipped).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Skipped (Silent)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {transcriptionResults.filter(r => r.error).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
              </div>

              {sessionInfo && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Session Information</h4>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(sessionInfo, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};