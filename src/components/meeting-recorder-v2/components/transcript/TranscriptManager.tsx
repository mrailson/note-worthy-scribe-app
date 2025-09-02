import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  FileText, 
  Download, 
  Copy, 
  Search, 
  Eye, 
  Edit3,
  Save,
  Undo,
  BarChart3
} from 'lucide-react';
import { TranscriptData } from '../../hooks/useRecordingManager';
import { ChunkStatusModal } from '@/components/ChunkStatusModal';
import { ChunkStatus } from '@/hooks/useChunkTracker';
import { ChunkSaveStatus } from '@/components/ChunkSaveStatus';

interface TranscriptManagerProps {
  transcripts: TranscriptData[];
  fullTranscript: string;
  isRecording: boolean;
  wordCount: number;
}

export const TranscriptManager = ({ 
  transcripts, 
  fullTranscript, 
  isRecording,
  wordCount 
}: TranscriptManagerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editableTranscript, setEditableTranscript] = useState(fullTranscript);
  const [isEditing, setIsEditing] = useState(false);

  // Convert TranscriptData to ChunkStatus format for the chunk status modal
  const chunks: ChunkStatus[] = transcripts.map((transcript, index) => ({
    id: `chunk_${index}_${Date.now()}`,
    timestamp: new Date(transcript.timestamp),
    text: transcript.text,
    confidence: transcript.confidence,
    wordCount: transcript.text.trim().split(/\s+/).filter(word => word.length > 0).length,
    status: transcript.confidence < 0.5 ? 'low_confidence' : 'success' as 'success' | 'low_confidence' | 'filtered',
    speaker: transcript.speaker,
    isFinal: transcript.isFinal
  }));

  // Convert TranscriptData to ChunkSaveStatus format for the chunk save status component
  const chunkSaveStatuses = transcripts.map((transcript, index) => ({
    chunkNumber: index + 1,
    text: transcript.text,
    chunkLength: transcript.text.length,
    saveStatus: transcript.isFinal ? 'saved' : 'saving' as 'saving' | 'saved' | 'failed' | 'retrying',
    saveTimestamp: transcript.timestamp,
    retryCount: 0,
    confidence: transcript.confidence
  }));

  const stats = {
    total: chunks.length,
    successful: chunks.filter(c => c.status === 'success').length,
    lowConfidence: chunks.filter(c => c.status === 'low_confidence').length,
    filtered: chunks.filter(c => c.status === 'filtered').length,
    totalWords: chunks.reduce((sum, c) => sum + c.wordCount, 0),
    avgConfidence: chunks.length > 0 ? chunks.reduce((sum, c) => sum + c.confidence, 0) / chunks.length : 0,
    successRate: chunks.length > 0 ? (chunks.filter(c => c.status === 'success').length / chunks.length) * 100 : 0
  };

  const clearChunks = () => {
    // In this context, clearing chunks would reset the transcript - not implemented for safety
    console.log('Clear chunks requested - not implemented in transcript manager');
  };

  const filteredTranscripts = transcripts.filter(t => 
    t.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.speaker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(fullTranscript);
  };

  const handleSaveEdit = () => {
    // Here you would save the edited transcript
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditableTranscript(fullTranscript);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* Transcript Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {wordCount.toLocaleString()} words
          </Badge>
          <Badge variant="outline" className="text-sm">
            {transcripts.length} segments
          </Badge>
          {isRecording && (
            <Badge variant="secondary" className="text-sm animate-pulse">
              Recording
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyTranscript}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <ChunkStatusModal 
            chunks={chunks}
            stats={stats}
            onClear={clearChunks}
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Full View
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl h-[80vh]">
              <DialogHeader>
                <DialogTitle>Full Transcript</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-full">
                <div className="space-y-4 p-4">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Button onClick={handleSaveEdit} size="sm">
                          <Save className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={handleCancelEdit} variant="outline" size="sm">
                          <Undo className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </div>
                      <Textarea
                        value={editableTranscript}
                        onChange={(e) => setEditableTranscript(e.target.value)}
                        className="min-h-[400px] font-mono text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Complete Transcript</h3>
                        <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                          {fullTranscript || 'No transcript available. Start recording to generate transcript.'}
                        </p>
                        {fullTranscript && (
                          <div className="mt-4 text-xs text-muted-foreground">
                            Note: Transcript has been automatically deduplicated to remove redundant content.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search transcript segments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Meeting Transcript Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Meeting Transcript
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-6 space-y-4">
              {filteredTranscripts.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    {searchTerm ? 'No matching segments' : 'No transcript segments'}
                  </p>
                  <p className="text-sm">
                    {searchTerm 
                      ? 'Try adjusting your search terms' 
                      : 'Start recording to see transcript segments here'
                    }
                  </p>
                </div>
              ) : (
                filteredTranscripts.map((segment, index) => (
                  <div key={index} className="space-y-3">
                    <div className="group p-4 rounded-lg bg-accent/5 hover:bg-accent/10 transition-colors">
                      <div className="flex items-start gap-3">
                        <Badge 
                          variant={segment.isFinal ? "default" : "secondary"} 
                          className="text-xs shrink-0"
                        >
                          {segment.speaker}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm leading-relaxed text-foreground mb-2">
                            {segment.text}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {new Date(segment.timestamp).toLocaleTimeString()}
                            </span>
                            <span>
                              Confidence: {Math.round(segment.confidence * 100)}%
                            </span>
                            <Badge 
                              variant={segment.isFinal ? "default" : "outline"}
                              className="text-xs"
                            >
                              {segment.isFinal ? 'Final' : 'Processing'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < filteredTranscripts.length - 1 && (
                      <Separator className="opacity-50" />
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chunk Save Status - positioned below Meeting Transcript Card */}
      <ChunkSaveStatus 
        chunks={chunkSaveStatuses} 
        isRecording={isRecording}
      />
    </div>
  );
};