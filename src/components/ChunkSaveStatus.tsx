import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle, Clock, XCircle, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

interface ChunkSaveStatus {
  id: string;
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
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default
  
  const savedChunks = chunks.filter(c => c.saveStatus === 'saved').length;
  const failedChunks = chunks.filter(c => c.saveStatus === 'failed').length;
  const pendingChunks = chunks.filter(c => c.saveStatus === 'saving' || c.saveStatus === 'retrying').length;
  
  const successRate = chunks.length > 0 ? Math.round((savedChunks / chunks.length) * 100) : 0;
  
  // Calculate total words transcribed from all chunks
  const totalWords = chunks.reduce((total, chunk) => {
    const wordCount = chunk.text.trim().split(/\s+/).filter(word => word.length > 0).length;
    return total + wordCount;
  }, 0);
  
  // Add console logging for debugging on mobile
  console.log('📊 ChunkSaveStatus render:', { 
    totalChunks: chunks.length, 
    savedChunks, 
    pendingChunks, 
    failedChunks, 
    totalWords,
    isRecording 
  });

  return (
    <Card className="border-accent/30 bg-card/95">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                📱 Chunk Save Status
              </CardTitle>
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CollapsibleTrigger>
          
          {/* Statistics - Always visible */}
          <div className="flex flex-wrap gap-1 sm:gap-2 mt-2">
            <Badge variant="outline" className="bg-success/10 text-success text-xs">
              ✅ Saved: {savedChunks}
            </Badge>
            {pendingChunks > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning text-xs">
                ⏳ Saving: {pendingChunks}
              </Badge>
            )}
            {failedChunks > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">
                ❌ Failed: {failedChunks}
              </Badge>
            )}
            <Badge variant="outline" className="bg-primary/10 text-primary text-xs">
              Rate: {successRate}%
            </Badge>
            <Badge variant="outline" className="bg-accent/10 text-accent-foreground text-xs">
              📝 Words: {totalWords}
            </Badge>
          </div>
          
          {/* Mobile-friendly status indicator - Always visible */}
          <div className="mt-2 p-2 bg-muted/50 rounded text-sm">
            📊 <strong>Total:</strong> {chunks.length} chunks • 
            <span className="text-accent ml-1">📝 {totalWords} words</span> • 
            <span className="text-success ml-1">✅ {savedChunks}</span> • 
            <span className="text-warning ml-1">⏳ {pendingChunks}</span>
            {failedChunks > 0 && <span className="text-destructive ml-1">❌ {failedChunks}</span>}
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            <ScrollArea className="h-40 sm:h-48">
              <div className="space-y-2">
                {chunks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {isRecording ? "📱 Listening for speech chunks..." : "No chunks processed yet"}
                  </div>
                ) : (
                  chunks.slice(-10).reverse().map((chunk) => {
                    const chunkWords = chunk.text.trim().split(/\s+/).filter(word => word.length > 0).length;
                    return (
                      <div
                        key={chunk.id}
                        className="flex items-start justify-between p-2 sm:p-3 rounded-lg border bg-card/50"
                      >
                        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                          {getStatusIcon(chunk.saveStatus)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">
                              Chunk #{chunk.chunkNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {chunk.chunkLength} chars • {chunkWords} words • {Math.round(chunk.confidence * 100)}% conf
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                              "{chunk.text}"
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right ml-2 flex-shrink-0">
                          <Badge 
                            variant="outline" 
                            className={`${getStatusColor(chunk.saveStatus)} text-xs`}
                          >
                            {chunk.saveStatus === 'saved' && '✅'}
                            {chunk.saveStatus === 'saving' && '⏳'}
                            {chunk.saveStatus === 'failed' && `❌`}
                            {chunk.saveStatus === 'retrying' && `🔄`}
                          </Badge>
                          {chunk.saveTimestamp && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {new Date(chunk.saveTimestamp).toLocaleTimeString()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};