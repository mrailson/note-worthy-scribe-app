// src/components/EnhancedTranscriptDisplay.tsx
// Enhanced transcript display with visual indicators and manual recovery options

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, ChevronDown, Clock, User, Volume2, Edit3, RotateCcw, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface TranscriptChunk {
  id?: string;
  text: string;
  timestamp?: number;
  confidence?: number;
  isFinal?: boolean;
  speaker?: string;
  chunkNumber?: number;
  source?: string;
}

interface EnhancedTranscriptDisplayProps {
  rawChunks: TranscriptChunk[];
  processedText: string;
  isLive?: boolean;
  onChunkRecover?: (chunk: TranscriptChunk) => void;
  onManualEdit?: (text: string) => void;
  showChunkBoundaries?: boolean;
  confidenceThreshold?: number;
}

export const EnhancedTranscriptDisplay: React.FC<EnhancedTranscriptDisplayProps> = ({
  rawChunks = [],
  processedText,
  isLive = false,
  onChunkRecover,
  onManualEdit,
  showChunkBoundaries = false,
  confidenceThreshold = 0.85
}) => {
  const [showRawChunks, setShowRawChunks] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(processedText);

  // Analyze chunks for quality indicators
  const chunkAnalysis = useMemo(() => {
    const lowConfidence = rawChunks.filter(chunk => 
      chunk.confidence !== undefined && chunk.confidence < confidenceThreshold
    );
    const missingTimestamps = rawChunks.filter(chunk => !chunk.timestamp);
    const nonFinal = rawChunks.filter(chunk => chunk.isFinal === false);
    
    return {
      total: rawChunks.length,
      lowConfidence: lowConfidence.length,
      missingTimestamps: missingTimestamps.length,
      nonFinal: nonFinal.length,
      avgConfidence: rawChunks.length > 0 
        ? rawChunks.reduce((sum, chunk) => sum + (chunk.confidence || 1), 0) / rawChunks.length
        : 1
    };
  }, [rawChunks, confidenceThreshold]);

  const handleSaveEdit = () => {
    onManualEdit?.(editText);
    setIsEditing(false);
    toast.success("Transcript updated manually");
  };

  const handleCancelEdit = () => {
    setEditText(processedText);
    setIsEditing(false);
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-muted text-muted-foreground";
    if (confidence >= 0.9) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (confidence >= 0.7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return "No timestamp";
    return format(new Date(timestamp), 'HH:mm:ss.SSS');
  };

  return (
    <div className="space-y-4">
      {/* Quality Indicators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Transcript Quality
              {isLive && (
                <Badge variant="secondary" className="animate-pulse">
                  ● LIVE
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawChunks(!showRawChunks)}
              >
                {showRawChunks ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                Raw Chunks
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-muted-foreground">Total Chunks</span>
              <span className="font-medium">{chunkAnalysis.total}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Avg Confidence</span>
              <Badge className={getConfidenceColor(chunkAnalysis.avgConfidence)} variant="secondary">
                {Math.round(chunkAnalysis.avgConfidence * 100)}%
              </Badge>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Low Quality</span>
              <span className={`font-medium ${chunkAnalysis.lowConfidence > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {chunkAnalysis.lowConfidence}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground">Processing</span>
              <span className={`font-medium ${chunkAnalysis.nonFinal > 0 ? 'text-blue-600' : 'text-green-600'}`}>
                {chunkAnalysis.nonFinal > 0 ? 'In Progress' : 'Complete'}
              </span>
            </div>
          </div>
          
          {chunkAnalysis.lowConfidence > 0 && (
            <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
              <div className="flex items-center gap-1 text-orange-800 dark:text-orange-200 text-xs">
                <AlertCircle className="h-3 w-3" />
                {chunkAnalysis.lowConfidence} chunks have low confidence scores
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw Chunks Display */}
      {showRawChunks && (
        <Card>
          <Collapsible open={showRawChunks} onOpenChange={setShowRawChunks}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  Raw Transcript Chunks ({rawChunks.length})
                  <ChevronDown className="h-4 w-4" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {rawChunks.map((chunk, index) => (
                    <div 
                      key={chunk.id || index} 
                      className={`p-2 rounded border text-xs ${
                        showChunkBoundaries ? 'border-dashed border-primary/30' : 'border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            #{chunk.chunkNumber || index}
                          </Badge>
                          {chunk.confidence && (
                            <Badge className={getConfidenceColor(chunk.confidence)} variant="secondary">
                              {Math.round(chunk.confidence * 100)}%
                            </Badge>
                          )}
                          {chunk.isFinal === false && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              Processing
                            </Badge>
                          )}
                          {chunk.speaker && (
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span>{chunk.speaker}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {chunk.timestamp && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatTimestamp(chunk.timestamp)}</span>
                            </div>
                          )}
                          {onChunkRecover && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => onChunkRecover(chunk)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="text-foreground">{chunk.text}</div>
                      {chunk.source && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Source: {chunk.source}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Processed Transcript */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-sm">Processed Transcript</span>
            {onManualEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (isEditing) {
                    handleCancelEdit();
                  } else {
                    setEditText(processedText);
                    setIsEditing(true);
                  }
                }}
              >
                <Edit3 className="h-4 w-4 mr-1" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                placeholder="Edit the transcript..."
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className={`min-h-[200px] max-h-[400px] overflow-y-auto p-3 border rounded-md bg-muted/20 font-mono text-sm whitespace-pre-wrap ${
              showChunkBoundaries ? 'border-dashed border-l-4 border-l-primary/30' : ''
            }`}>
              {processedText || (isLive ? "Listening for audio..." : "No transcript available")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chunk boundary indicator - using Tailwind classes instead of CSS-in-JS */}
    </div>
  );
};