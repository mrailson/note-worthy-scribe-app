import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TranscriptData } from "@/types/gpscribe";
import { format } from "date-fns";
import { Copy, Edit, Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { LowConfidenceReview } from "@/components/LowConfidenceReview";
import { ChunkStatusModal } from "@/components/ChunkStatusModal";
import { ChunkStatus } from "@/hooks/useChunkTracker";

interface TranscriptPanelProps {
  transcript: string;
  realtimeTranscripts: TranscriptData[];
  cleanedTranscript: string;
  isCleaningTranscript: boolean;
  showTranscriptTimestamps: boolean;
  isRecording: boolean;
  meetingId?: string;
  sessionId?: string;
  userId?: string;
  chunks?: ChunkStatus[];
  chunkStats?: {
    total: number;
    successful: number;
    lowConfidence: number;
    filtered: number;
    totalWords: number;
    avgConfidence: number;
    successRate: number;
  };
  onTranscriptChange: (transcript: string) => void;
  onCleanTranscript: () => void;
  onClearTranscript: () => void;
  onClearChunks?: () => void;
}

export const TranscriptPanel = ({
  transcript,
  realtimeTranscripts,
  cleanedTranscript,
  isCleaningTranscript,
  showTranscriptTimestamps,
  isRecording,
  meetingId,
  sessionId,
  userId,
  chunks = [],
  chunkStats = {
    total: 0,
    successful: 0,
    lowConfidence: 0,
    filtered: 0,
    totalWords: 0,
    avgConfidence: 0,
    successRate: 0
  },
  onTranscriptChange,
  onCleanTranscript,
  onClearTranscript,
  onClearChunks
}: TranscriptPanelProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = () => {
    setEditValue(transcript);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onTranscriptChange(editValue);
    setIsEditing(false);
    toast.success("Transcript updated");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-4">
      {/* Live Transcript */}
      {isRecording && realtimeTranscripts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              Live Transcript
              <Badge variant="secondary" className="animate-pulse text-xs">
                ● LIVE
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {realtimeTranscripts.slice(-5).map((item, index) => (
                <div key={index} className="text-sm">
                  {showTranscriptTimestamps && (
                    <span className="text-muted-foreground text-xs mr-2">
                      {format(new Date(item.timestamp), 'HH:mm:ss')}
                    </span>
                  )}
                  <span className="font-medium text-primary mr-2">
                    {item.speaker}:
                  </span>
                  <span className={!item.isFinal ? "text-muted-foreground" : ""}>
                    {item.text}
                  </span>
                  {item.confidence && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {Math.round(item.confidence * 100)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Transcript */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Transcript</CardTitle>
            <div className="flex items-center gap-2">
              {transcript && (
                <>
                  <Button
                    onClick={() => copyToClipboard(transcript)}
                    variant="outline"
                    size="sm"
                    className="touch-manipulation min-h-[44px]"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleStartEdit}
                    variant="outline"
                    size="sm"
                    disabled={isEditing}
                    className="touch-manipulation min-h-[44px]"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={onCleanTranscript}
                    variant="outline"
                    size="sm"
                    disabled={isCleaningTranscript}
                    className="touch-manipulation min-h-[44px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <ChunkStatusModal 
                    chunks={chunks}
                    stats={chunkStats}
                    onClear={onClearChunks || (() => {})}
                  />
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Edit transcript..."
                className="min-h-[300px] max-h-[600px] overflow-y-auto resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  size="sm"
                  className="touch-manipulation min-h-[44px]"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  size="sm"
                  className="bg-gradient-primary hover:bg-primary-hover touch-manipulation min-h-[44px]"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-h-[300px] max-h-[600px] overflow-y-auto p-3 border rounded-md bg-background text-sm font-mono whitespace-pre-wrap break-words">
              {transcript || (isRecording ? "Listening..." : "No transcript yet. Start recording to begin.")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleaned Transcript */}
      {cleanedTranscript && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Cleaned Transcript</CardTitle>
              <Button
                onClick={() => copyToClipboard(cleanedTranscript)}
                variant="outline"
                size="sm"
                className="touch-manipulation min-h-[44px]"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={cleanedTranscript}
              readOnly
              className="min-h-[300px] max-h-[600px] overflow-y-auto resize-none"
            />
          </CardContent>
        </Card>
      )}

      {/* Low Confidence Review - Only show if we have the required props */}
      {meetingId && sessionId && userId && (
        <LowConfidenceReview 
          meetingId={meetingId}
          sessionId={sessionId}
          userId={userId}
        />
      )}

      {transcript && (
        <div className="flex justify-center">
          <Button
            onClick={onClearTranscript}
            variant="outline"
            className="touch-manipulation min-h-[44px]"
          >
            Clear Transcript
          </Button>
        </div>
      )}
    </div>
  );
};