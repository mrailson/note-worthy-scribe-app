// src/components/RawChunksDisplay.tsx
// Enhanced raw chunks display with progressive enhancement and recovery options

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, RotateCcw, ChevronDown, Clock, User, Volume2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface RawChunk {
  id: string;
  text: string;
  timestamp?: number;
  confidence?: number;
  isFinal?: boolean;
  speaker?: string;
  chunkNumber?: number;
  source?: string;
}

interface RawChunksDisplayProps {
  chunks: RawChunk[];
  isRecording?: boolean;
  onChunkRecover?: (chunk: RawChunk) => void;
  autoScroll?: boolean;
  confidenceThreshold?: number;
}

export const RawChunksDisplay: React.FC<RawChunksDisplayProps> = ({
  chunks = [],
  isRecording = false,
  onChunkRecover,
  autoScroll = true,
  confidenceThreshold = 0.85
}) => {
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new chunks arrive (if enabled and user hasn't manually scrolled)
  useEffect(() => {
    if (autoScroll && !userScrolled && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [chunks.length, autoScroll, userScrolled]);

  // Detect user scrolling to disable auto-scroll
  const handleScroll = () => {
    if (!userScrolled) {
      setUserScrolled(true);
    }
  };

  // Re-enable auto-scroll button
  const handleScrollToBottom = () => {
    setUserScrolled(false);
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-muted text-muted-foreground";
    if (confidence >= 0.9) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (confidence >= 0.7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return null;
    return format(new Date(timestamp), 'HH:mm:ss');
  };

  const lowQualityChunks = chunks.filter(chunk => 
    chunk.confidence !== undefined && chunk.confidence < confidenceThreshold
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Raw Transcript Chunks
            {isRecording && (
              <Badge variant="secondary" className="animate-pulse text-xs">
                ● REC
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {chunks.length}
            </Badge>
          </div>
          {userScrolled && chunks.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScrollToBottom}
              className="text-xs"
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Scroll to latest
            </Button>
          )}
        </CardTitle>
        
        {lowQualityChunks.length > 0 && (
          <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
            <div className="flex items-center gap-1 text-orange-800 dark:text-orange-200 text-xs">
              <AlertCircle className="h-3 w-3" />
              {lowQualityChunks.length} chunk{lowQualityChunks.length !== 1 ? 's' : ''} with low confidence
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <ScrollArea 
          ref={scrollAreaRef}
          className="h-64"
          onScroll={handleScroll}
        >
          {chunks.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              {isRecording ? "Waiting for audio chunks..." : "No transcript chunks available"}
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {chunks.map((chunk, index) => (
                <div 
                  key={chunk.id || index}
                  className="p-3 rounded border border-border bg-card transition-colors hover:bg-muted/50"
                >
                  {/* Chunk metadata header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs font-mono">
                        #{chunk.chunkNumber ?? index}
                      </Badge>
                      
                      {chunk.confidence !== undefined && (
                        <Badge className={`${getConfidenceColor(chunk.confidence)} text-xs`}>
                          {Math.round(chunk.confidence * 100)}%
                        </Badge>
                      )}
                      
                      {chunk.isFinal === false && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs">
                          Processing...
                        </Badge>
                      )}
                      
                      {chunk.speaker && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{chunk.speaker}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {chunk.timestamp && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(chunk.timestamp)}</span>
                        </div>
                      )}
                      
                      {onChunkRecover && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            onChunkRecover(chunk);
                            toast.success(`Recovered chunk #${chunk.chunkNumber ?? index}`);
                          }}
                          title="Recover this chunk to main transcript"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Chunk text content */}
                  <div className="text-sm text-foreground leading-relaxed">
                    {chunk.text}
                  </div>
                  
                  {/* Additional metadata */}
                  {chunk.source && (
                    <div className="mt-2 text-xs text-muted-foreground border-t border-border pt-1">
                      Source: <span className="font-mono">{chunk.source}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};