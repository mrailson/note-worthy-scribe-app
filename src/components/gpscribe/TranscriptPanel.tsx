import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  Edit, 
  Save, 
  X, 
  Trash2, 
  Sparkles, 
  FileText,
  Eye,
  EyeOff,
  Radio,
  Volume2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { ChunkStatusModal } from '@/components/ChunkStatusModal';
import { AssemblyRealtimeTicker } from '@/components/AssemblyRealtimeTicker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TranscriptPanelProps {
  transcript: string;
  isRecording: boolean;
  realtimeTranscripts?: string[];
  cleanedTranscript?: string;
  isCleaningTranscript?: boolean;
  onTranscriptChange?: (transcript: string) => void;
  onCleanTranscript?: () => void;
  onClearTranscript?: () => void;
  meetingId?: string;
  sessionId?: string;
  userId?: string;
  chunkTracker?: any;
  // Dual transcription props
  assemblyTranscript?: string;
  assemblyStatus?: string;
  assemblyConfidence?: number;
  assemblyEnabled?: boolean;
  primarySource?: 'assembly' | 'whisper' | 'merged';
  onPrimarySourceChange?: (source: 'assembly' | 'whisper' | 'merged') => void;
  assemblyChunks?: Array<{
    text: string;
    isFinal?: boolean;
    seq?: number;
    start_ms?: number;
    end_ms?: number;
    source?: string;
  }>;
  whisperChunks?: Array<{
    text: string;
    isFinal?: boolean;
    seq?: number;
    start_ms?: number;
    end_ms?: number;
    source?: string;
  }>;
  assemblyWordCount?: number;
  whisperWordCount?: number;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  transcript,
  isRecording,
  realtimeTranscripts = [],
  cleanedTranscript,
  isCleaningTranscript = false,
  onTranscriptChange,
  onCleanTranscript,
  onClearTranscript,
  meetingId,
  sessionId,
  userId,
  chunkTracker,
  assemblyTranscript = '',
  assemblyStatus = 'idle',
  assemblyConfidence = 0,
  assemblyEnabled = false,
  primarySource = 'whisper',
  onPrimarySourceChange,
  assemblyChunks = [],
  whisperChunks = [],
  assemblyWordCount = 0,
  whisperWordCount = 0
}) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = () => {
    setEditValue(transcript);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (onTranscriptChange) {
      onTranscriptChange(editValue);
    }
    setIsEditing(false);
    toast({
      title: "Transcript Updated",
      description: "Your changes have been saved."
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to Clipboard",
      description: `${label} copied successfully.`
    });
  };

  return (
    <div className="space-y-6">
      {/* Assembly AI Real-time Ticker */}
      {assemblyEnabled && (
        <AssemblyRealtimeTicker
          transcript={assemblyTranscript}
          status={assemblyStatus}
          confidence={assemblyConfidence}
          isEnabled={assemblyEnabled}
          className="mb-4"
        />
      )}

      {/* Prominent Transcript Source Toggle */}
      {onPrimarySourceChange && (
        <Card className="mb-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 border-2">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Select Primary Transcript Source</h3>
                <p className="text-xs text-muted-foreground">
                  Choose which AI service provides your main transcript. Compare both in the Comparison tab.
                </p>
              </div>
              <div className="flex rounded-lg border-2 border-primary/20 p-1 bg-background shadow-sm">
                <Button
                  variant={primarySource === 'whisper' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onPrimarySourceChange('whisper')}
                  className="flex-1 min-w-[80px] text-xs font-medium"
                >
                  🎤 Whisper
                </Button>
                <Button
                  variant={primarySource === 'assembly' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onPrimarySourceChange('assembly')}
                  className="flex-1 min-w-[80px] text-xs font-medium"
                >
                  ⚡ Assembly AI
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Currently using: <span className="font-semibold text-foreground">
                {primarySource === 'assembly' ? '⚡ Assembly AI' : '🎤 Whisper'}
              </span> as primary source
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dual Transcription Tabs */}
      <Tabs defaultValue="live" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Live
          </TabsTrigger>
          <TabsTrigger value="transcripts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Transcripts
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Comparison
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live">
          {/* Live Transcript Section */}
          <div className="space-y-4">
            {/* Assembly AI Live Updates */}
            {assemblyEnabled && isRecording && (
              <Card className="border-blue-500 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                      Assembly AI Live
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {Math.round(assemblyConfidence * 100)}% confidence
                      </Badge>
                    </CardTitle>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      {assemblyWordCount} words
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {assemblyChunks.length > 0 ? (
                      assemblyChunks.slice(-5).map((chunk, index) => (
                        <p key={index} className="text-sm mb-2 last:mb-0">
                          <Badge variant="outline" className="text-xs mr-2">
                            {chunk.source}
                          </Badge>
                          {chunk.text}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">Waiting for Assembly AI transcription...</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Whisper Live Updates */}
            {isRecording && realtimeTranscripts.length > 0 && (
              <Card className="border-green-500 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      Whisper Live
                    </CardTitle>
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      {whisperWordCount} words
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    {realtimeTranscripts.map((chunk, index) => (
                      <p key={index} className="text-sm mb-2 last:mb-0">
                        <Badge variant="outline" className="text-xs mr-2">
                          whisper
                        </Badge>
                        {chunk}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No live data message */}
            {!isRecording && (
              <Card className="border-gray-200">
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Start recording to see live transcription updates</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transcripts">
          {/* Main Transcript Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Primary Transcript
                  {transcript && (
                    <Badge variant="outline" className="ml-2">
                      {transcript.split(' ').length} words
                    </Badge>
                  )}
                  {primarySource && (
                    <Badge variant={primarySource === 'assembly' ? 'default' : 'secondary'} className="ml-2">
                      {primarySource === 'assembly' ? 'Assembly AI' : 'Whisper'}
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {onPrimarySourceChange && (
                    <div className="flex rounded-lg border p-1">
                      <Button
                        variant={primarySource === 'whisper' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onPrimarySourceChange('whisper')}
                        className="h-7 px-2"
                      >
                        Whisper
                      </Button>
                      <Button
                        variant={primarySource === 'assembly' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => onPrimarySourceChange('assembly')}
                        className="h-7 px-2"
                      >
                        Assembly
                      </Button>
                    </div>
                  )}
                  {transcript && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(transcript, 'Transcript')}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  )}
                  {!isEditing && transcript && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                  {chunkTracker && chunkTracker.chunks && (
                    <ChunkStatusModal 
                      chunks={chunkTracker.chunks}
                      stats={chunkTracker.stats}
                      onClear={chunkTracker.clearChunks}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <div className="space-y-4">
                  <Textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="min-h-[75vh] resize-vertical"
                    placeholder="Edit your transcript here..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} size="sm">
                      <Save className="h-4 w-4 mr-1" />
                      Save Changes
                    </Button>
                    <Button onClick={handleCancelEdit} variant="outline" size="sm">
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
              {transcript ? (
                <div className="bg-muted/30 rounded-lg p-4 min-h-[200px] max-h-none whitespace-pre-wrap overflow-auto text-foreground">
                  {transcript}
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg p-4 min-h-[200px] flex items-center justify-center text-muted-foreground">
                  {isRecording 
                    ? "Transcription will appear here as you speak..."
                    : "No transcript available. Start recording to generate a transcript."
                  }
                </div>
              )}
                  {transcript && (
                    <div className="flex gap-2">
                      {onCleanTranscript && (
                        <Button
                          onClick={onCleanTranscript}
                          disabled={isCleaningTranscript}
                          variant="outline"
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          {isCleaningTranscript ? 'Cleaning...' : 'Clean Transcript'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison">
          {/* Dual Transcript Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Whisper Transcript
                  <Badge variant="secondary" className="text-xs">
                    {assemblyWordCount || 0} words
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-blue-50 rounded-lg p-4 min-h-[200px] max-h-96 overflow-y-auto">
                  {transcript || (
                    <span className="text-muted-foreground text-sm">
                      No Whisper transcript available
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  Assembly AI Transcript
                  <Badge variant="default" className="text-xs">
                    {assemblyWordCount || 0} words
                  </Badge>
                  {assemblyConfidence > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {Math.round(assemblyConfidence * 100)}% confidence
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 rounded-lg p-4 min-h-[200px] max-h-96 overflow-y-auto">
                  {assemblyTranscript || (
                    <span className="text-muted-foreground text-sm">
                      {assemblyEnabled ? 'No Assembly AI transcript available' : 'Assembly AI disabled'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Cleaned Transcript */}
      {cleanedTranscript && cleanedTranscript.trim() && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI-Cleaned Transcript
                <Badge variant="outline" className="ml-2">
                  {cleanedTranscript.split(' ').length} words
                </Badge>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(cleanedTranscript, 'Cleaned Transcript')}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-purple-50 rounded-lg p-4 min-h-[200px] whitespace-pre-wrap">
              {cleanedTranscript}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clear Actions */}
      {(transcript || cleanedTranscript) && onClearTranscript && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={onClearTranscript}
            variant="outline"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All Transcripts
          </Button>
        </div>
      )}
    </div>
  );
};