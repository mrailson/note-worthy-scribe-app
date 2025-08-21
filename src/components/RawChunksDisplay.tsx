import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface RawChunk {
  id: number;
  text: string;
  timestamp: string;
  confidence?: number;
}

interface RawChunksDisplayProps {
  chunks: RawChunk[];
  isRecording: boolean;
}

export const RawChunksDisplay: React.FC<RawChunksDisplayProps> = ({ 
  chunks, 
  isRecording 
}) => {
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto scroll to bottom when new chunks arrive
  useEffect(() => {
    if (autoScroll && chunks.length > 0) {
      const scrollElement = document.getElementById('raw-chunks-scroll');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [chunks, autoScroll]);

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Raw Chunked Transcript</CardTitle>
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge variant="secondary" className="animate-pulse">
                Recording
              </Badge>
            )}
            <Badge variant="outline">
              {chunks.length} chunks
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea 
          id="raw-chunks-scroll"
          className="h-48 w-full rounded-md border p-4"
          onWheel={() => setAutoScroll(false)}
          onTouchMove={() => setAutoScroll(false)}
        >
          {chunks.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {isRecording ? 'Waiting for transcript chunks...' : 'No chunks recorded'}
            </div>
          ) : (
            <div className="space-y-3">
              {chunks.map((chunk, index) => (
                <div key={chunk.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      #{chunk.id}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {chunk.timestamp}
                    </span>
                    {chunk.confidence && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round(chunk.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="leading-relaxed text-foreground">
                    {chunk.text}
                  </div>
                  {index < chunks.length - 1 && (
                    <div className="mt-3 border-b border-muted/30"></div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {chunks.length > 3 && (
          <div className="mt-2 flex justify-center">
            <button 
              onClick={() => {
                setAutoScroll(true);
                const scrollElement = document.getElementById('raw-chunks-scroll');
                if (scrollElement) {
                  scrollElement.scrollTop = scrollElement.scrollHeight;
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Scroll to latest
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};