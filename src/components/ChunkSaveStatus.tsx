import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, XCircle, RefreshCw, ChevronDown, ChevronRight, Download } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

interface ChunkSaveStatus {
  id: string;
  chunkNumber: number;
  text: string;
  chunkLength: number;
  saveStatus: 'saving' | 'saved' | 'failed' | 'retrying';
  saveTimestamp?: string;
  retryCount: number;
  confidence: number;
  startTime?: number; // in seconds
  endTime?: number; // in seconds
  mergeRejectionReason?: string; // Reason why chunk wasn't merged into transcript
}

interface ChunkSaveStatusProps {
  chunks: ChunkSaveStatus[];
  isRecording: boolean;
  mainTranscript: string;
  onMergeUnmergedChunks?: () => void;
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

/**
 * Splits chunk text and highlights last word as tentative/guessed
 */
const renderChunkTextWithLastWordHighlight = (text: string) => {
  if (!text || text.trim().length === 0) return <span>"{text}"</span>;
  
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);
  
  if (words.length === 0) return <span>"{text}"</span>;
  if (words.length === 1) {
    return <span className="opacity-30 italic">"{trimmed}"</span>;
  }
  
  const lastWord = words[words.length - 1];
  const beforeLastWord = words.slice(0, -1).join(' ');
  
  return (
    <span>
      "{beforeLastWord}{' '}
      <span className="opacity-30 italic" title="Last word may be preliminary">{lastWord}</span>"
    </span>
  );
};

// Export chunks to Word document
const exportChunksToWord = async (chunks: ChunkSaveStatus[], mainTranscript: string, isChunkInTranscript: (text: string) => boolean) => {
  const formatTime = (seconds: number | undefined): string => {
    if (seconds === undefined) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}m ${secs}s`;
  };

  const tableRows: TableRow[] = [
    // Header row
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true })] })], width: { size: 5, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Start', bold: true })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'End', bold: true })] })], width: { size: 10, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Duration', bold: true })] })], width: { size: 8, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Words', bold: true })] })], width: { size: 6, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Conf', bold: true })] })], width: { size: 6, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Merged', bold: true })] })], width: { size: 7, type: WidthType.PERCENTAGE } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Text', bold: true })] })], width: { size: 48, type: WidthType.PERCENTAGE } }),
      ],
    }),
  ];

  // Data rows
  chunks.forEach((chunk, index) => {
    const wordCount = chunk.text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const duration = chunk.startTime !== undefined && chunk.endTime !== undefined 
      ? (chunk.endTime - chunk.startTime).toFixed(1) + 's' 
      : 'N/A';
    const merged = isChunkInTranscript(chunk.text) ? '✓' : '✗';
    const rejectionNote = chunk.mergeRejectionReason ? ` [${chunk.mergeRejectionReason}]` : '';

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(index + 1))] }),
          new TableCell({ children: [new Paragraph(formatTime(chunk.startTime))] }),
          new TableCell({ children: [new Paragraph(formatTime(chunk.endTime))] }),
          new TableCell({ children: [new Paragraph(duration)] }),
          new TableCell({ children: [new Paragraph(String(wordCount))] }),
          new TableCell({ children: [new Paragraph(`${Math.round(chunk.confidence * 100)}%`)] }),
          new TableCell({ children: [new Paragraph(merged)] }),
          new TableCell({ children: [new Paragraph(chunk.text.trim() + rejectionNote)] }),
        ],
      })
    );
  });

  // Calculate totals
  const totalWords = chunks.reduce((sum, c) => sum + c.text.trim().split(/\s+/).filter(w => w.length > 0).length, 0);
  const totalDuration = chunks.reduce((sum, c) => {
    if (c.startTime !== undefined && c.endTime !== undefined) {
      return sum + (c.endTime - c.startTime);
    }
    return sum;
  }, 0);
  const avgConfidence = chunks.length > 0 
    ? chunks.reduce((sum, c) => sum + c.confidence, 0) / chunks.length 
    : 0;
  const mergedCount = chunks.filter(c => isChunkInTranscript(c.text)).length;

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Audio Chunk Analysis Report',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: `Generated: ${new Date().toLocaleString('en-GB')}`,
        }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Summary',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({ text: `Total Chunks: ${chunks.length}` }),
        new Paragraph({ text: `Total Words: ${totalWords}` }),
        new Paragraph({ text: `Total Duration: ${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s` }),
        new Paragraph({ text: `Average Confidence: ${Math.round(avgConfidence * 100)}%` }),
        new Paragraph({ text: `Chunks Merged: ${mergedCount}/${chunks.length}` }),
        new Paragraph({ text: '' }),
        new Paragraph({
          text: 'Chunk Details',
          heading: HeadingLevel.HEADING_2,
        }),
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `chunk-analysis-${new Date().toISOString().slice(0, 10)}.docx`);
};

export const ChunkSaveStatus: React.FC<ChunkSaveStatusProps> = ({ 
  chunks, 
  isRecording, 
  mainTranscript, 
  onMergeUnmergedChunks 
}) => {
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default
  
  const savedChunks = chunks.filter(c => c.saveStatus === 'saved').length;
  const failedChunks = chunks.filter(c => c.saveStatus === 'failed').length;
  const pendingChunks = chunks.filter(c => c.saveStatus === 'saving' || c.saveStatus === 'retrying').length;
  
  const successRate = chunks.length > 0 ? Math.round((savedChunks / chunks.length) * 100) : 0;
  
  // Robustly check if a chunk appears in the main transcript
  const isChunkInTranscript = (chunkText: string): boolean => {
    if (!chunkText || !mainTranscript) return false;

    const normalise = (s: string) => s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ') // remove punctuation
      .replace(/\s+/g, ' ') // collapse spaces
      .trim();

    const tNorm = normalise(mainTranscript);

    // Remove the last word (often tentative) before matching
    const words = chunkText.trim().split(/\s+/);
    const coreText = words.length > 1 ? words.slice(0, -1).join(' ') : words.join(' ');
    const cNorm = normalise(coreText);

    if (!cNorm) return false;

    // 1) Direct substring match on normalised text
    if (tNorm.includes(cNorm)) return true;

    // 2) Any 5-word n-gram from the chunk present in transcript
    if (words.length >= 5) {
      for (let i = 0; i <= words.length - 5; i++) {
        const gram = normalise(words.slice(i, i + 5).join(' '));
        if (gram && tNorm.includes(gram)) return true;
      }
    }

    // 3) Fallback: significant-word overlap (>=70%), ignoring very short words
    const cTokens = cNorm.split(' ').filter(w => w.length >= 3);
    if (cTokens.length === 0) return false;
    const matched = cTokens.filter(w => tNorm.includes(w)).length;
    return (matched / cTokens.length) >= 0.7;
  };
  // Calculate chunks that were merged into main transcript
  const chunksMergedToTranscript = chunks.filter(chunk => 
    chunk.text && chunk.text.trim().length > 0 && isChunkInTranscript(chunk.text)
  ).length;
  
  const chunksRecorded = chunks.length;
  
  // Calculate total words transcribed from all chunks
  const totalWords = chunks.reduce((total, chunk) => {
    const wordCount = chunk.text.trim().split(/\s+/).filter(word => word.length > 0).length;
    return total + wordCount;
  }, 0);
  
  // Calculate total time from all chunks
  const totalTimeSeconds = chunks.reduce((total, chunk) => {
    if (chunk.startTime !== undefined && chunk.endTime !== undefined) {
      return total + (chunk.endTime - chunk.startTime);
    }
    return total;
  }, 0);
  
  // Format total time as H:MM:SS
  const hours = Math.floor(totalTimeSeconds / 3600);
  const minutes = Math.floor((totalTimeSeconds % 3600) / 60);
  const seconds = Math.floor(totalTimeSeconds % 60);
  const formattedTotalTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Add console logging for debugging
  console.log('📊 ChunkSaveStatus render:', { 
    totalChunks: chunks.length, 
    savedChunks, 
    pendingChunks, 
    failedChunks, 
    totalWords,
    chunksMergedToTranscript,
    chunksRecorded,
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
                📱 Audio Chunking Live Overview
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
            <Badge 
              variant="outline" 
              className={`${chunksMergedToTranscript === chunksRecorded ? "bg-success/10 text-success" : "bg-warning/10 text-warning hover:bg-warning/30"} text-xs ${onMergeUnmergedChunks && chunksMergedToTranscript < chunksRecorded ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (onMergeUnmergedChunks && chunksMergedToTranscript < chunksRecorded) {
                  onMergeUnmergedChunks();
                }
              }}
              title={chunksMergedToTranscript < chunksRecorded ? "Click to merge unmerged chunks into transcript" : "All chunks merged"}
            >
              🔗 Merged: {chunksMergedToTranscript}/{chunksRecorded}
            </Badge>
            {chunks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  exportChunksToWord(chunks, mainTranscript, isChunkInTranscript);
                }}
                title="Download chunk analysis as Word document"
              >
                <Download className="h-3 w-3" />
                Word
              </Button>
            )}
          </div>
          
          {/* Mobile-friendly status indicator - Always visible */}
          <div className="mt-2 p-2 bg-muted/50 rounded text-sm text-foreground">
            📊 <strong>Total:</strong> {chunks.length} chunks • 
            <span className="ml-1">⏱️ {formattedTotalTime}</span> • 
            <span className="ml-1">📝 {totalWords} words</span> • 
            <span className="text-success ml-1">✅ {savedChunks}</span> • 
            <span className="text-warning ml-1">⏳ {pendingChunks}</span>
            {failedChunks > 0 && <span className="text-destructive ml-1">❌ {failedChunks}</span>}
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pb-3 pt-2">
            <ScrollArea className="h-64 sm:h-80">
              <div className="space-y-2">
                {chunks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    {isRecording ? "📱 Listening for speech chunks..." : "No chunks processed yet"}
                  </div>
                ) : (
                  chunks.slice().reverse().map((chunk) => {
                    const chunkWords = chunk.text.trim().split(/\s+/).filter(word => word.length > 0).length;
                    const inTranscript = isChunkInTranscript(chunk.text);
                    return (
                      <div
                        key={chunk.id}
                        className="flex items-start justify-between p-2 sm:p-3 rounded-lg border bg-card/50"
                      >
                          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                          {getStatusIcon(chunk.saveStatus)}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                              <span>Chunk #{chunk.chunkNumber}</span>
                              {inTranscript && (
                                <span className="inline-flex items-center" title="80%+ of chunk text appears in main transcript">
                                  <CheckCircle className="h-4 w-4 text-success" />
                                </span>
                              )}
                              {chunk.startTime !== undefined && chunk.endTime !== undefined && (
                                <span className="text-xs text-primary font-mono">
                                  {Math.floor(chunk.startTime / 60)}m {(chunk.startTime % 60).toFixed(1)}s → {Math.floor(chunk.endTime / 60)}m {(chunk.endTime % 60).toFixed(1)}s ({(chunk.endTime - chunk.startTime).toFixed(1)}s) ({chunkWords} words) {Math.round(chunk.confidence * 100)}% conf
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                              {renderChunkTextWithLastWordHighlight(chunk.text)}
                            </div>
                            {chunk.mergeRejectionReason && (
                              <div className="text-xs text-destructive font-semibold mt-1 p-1 bg-destructive/10 rounded">
                                ⚠️ Not merged: {chunk.mergeRejectionReason}
                              </div>
                            )}
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