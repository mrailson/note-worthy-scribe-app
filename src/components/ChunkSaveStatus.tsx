import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

interface ChunkSaveStatus {
  chunkNumber: number;
  text: string;
  chunkLength: number;
  saveStatus: 'saving' | 'saved' | 'failed' | 'retrying';
  saveTimestamp?: string;
  retryCount: number;
  confidence: number;
}

interface ChunkSaveStatusProps {
  chunks: ChunkSaveStatus[];
  isRecording: boolean;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'saved':
      return <CheckCircle className="h-4 w-4 text-success" />;
    case 'saving':
    case 'retrying':
      return <Clock className="h-4 w-4 text-warning animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'saved':
      return 'bg-success/10 text-success hover:bg-success/20';
    case 'saving':
      return 'bg-warning/10 text-warning hover:bg-warning/20';
    case 'retrying':
      return 'bg-warning/10 text-warning hover:bg-warning/20';
    case 'failed':
      return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
    default:
      return 'bg-muted/10 text-muted-foreground hover:bg-muted/20';
  }
};

export const ChunkSaveStatus: React.FC<ChunkSaveStatusProps> = ({ chunks, isRecording }) => {
  const savedChunks = chunks.filter(c => c.saveStatus === 'saved').length;
  const failedChunks = chunks.filter(c => c.saveStatus === 'failed').length;
  const pendingChunks = chunks.filter(c => c.saveStatus === 'saving' || c.saveStatus === 'retrying').length;
  
  const successRate = chunks.length > 0 ? Math.round((savedChunks / chunks.length) * 100) : 0;

  return (
    <Card className="border-accent/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Chunk Save Status
        </CardTitle>
        
        {/* Statistics */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="bg-success/10 text-success">
            ✅ Saved: {savedChunks}
          </Badge>
          {pendingChunks > 0 && (
            <Badge variant="outline" className="bg-warning/10 text-warning">
              ⏳ Saving: {pendingChunks}
            </Badge>
          )}
          {failedChunks > 0 && (
            <Badge variant="outline" className="bg-destructive/10 text-destructive">
              ❌ Failed: {failedChunks}
            </Badge>
          )}
          <Badge variant="outline" className="bg-primary/10 text-primary">
            Success Rate: {successRate}%
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {chunks.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                {isRecording ? "Listening for speech chunks..." : "No chunks processed yet"}
              </div>
            ) : (
              chunks.slice(-10).reverse().map((chunk) => (
                <div
                  key={chunk.chunkNumber}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(chunk.saveStatus)}
                    <div>
                      <div className="text-sm font-medium">
                        Chunk #{chunk.chunkNumber}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {chunk.chunkLength} chars • {Math.round(chunk.confidence * 100)}% conf
                      </div>
                      <div className="text-xs text-muted-foreground max-w-xs truncate">
                        "{chunk.text.substring(0, 50)}..."
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge 
                      variant="outline" 
                      className={getStatusColor(chunk.saveStatus)}
                    >
                      {chunk.saveStatus === 'saved' && '✅ Saved'}
                      {chunk.saveStatus === 'saving' && '⏳ Saving...'}
                      {chunk.saveStatus === 'failed' && `❌ Failed ${chunk.retryCount > 0 ? `(${chunk.retryCount}/3)` : ''}`}
                      {chunk.saveStatus === 'retrying' && `🔄 Retry ${chunk.retryCount}/3`}
                    </Badge>
                    {chunk.saveTimestamp && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(chunk.saveTimestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};