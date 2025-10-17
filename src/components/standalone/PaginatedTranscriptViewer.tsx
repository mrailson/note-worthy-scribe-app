import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface PaginatedTranscriptViewerProps {
  transcript: string;
  pageSize?: number;
  onDownload?: () => void;
}

export const PaginatedTranscriptViewer: React.FC<PaginatedTranscriptViewerProps> = ({
  transcript,
  pageSize = 5000, // ~5KB per page
  onDownload
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  const pages = useMemo(() => {
    if (!transcript) return [];
    
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences = transcript.split(/(?<=[.!?])\s+/);
    
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > pageSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [transcript];
  }, [transcript, pageSize]);

  const stats = useMemo(() => {
    const words = transcript.trim().split(/\s+/).filter(w => w.length > 0).length;
    const characters = transcript.length;
    return { words, characters };
  }, [transcript]);

  const totalPages = pages.length;
  const currentContent = pages[currentPage] || '';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Transcript</h3>
          <Badge variant="secondary">
            Page {currentPage + 1} of {totalPages}
          </Badge>
          {totalPages > 1 && (
            <Badge variant="outline">
              Large transcript - paginated for performance
            </Badge>
          )}
        </div>

        {onDownload && (
          <Button
            onClick={onDownload}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Full
          </Button>
        )}
      </div>

      <div className="min-h-[300px] max-h-[500px] overflow-y-auto mb-4">
        {currentContent ? (
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap text-foreground leading-relaxed">
              {currentContent}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>No transcript available</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Words: {stats.words} | Characters: {stats.characters}
          </div>

          <Button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {totalPages === 1 && (
        <div className="pt-4 border-t border-border">
          <div className="text-sm text-muted-foreground text-center">
            Words: {stats.words} | Characters: {stats.characters}
          </div>
        </div>
      )}
    </Card>
  );
};
