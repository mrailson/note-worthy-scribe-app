import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Download, FilePlus2, Loader2, Sparkles } from 'lucide-react';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import { saveAs } from 'file-saver';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PaginatedTranscriptViewerProps {
  transcript: string;
  pageSize?: number;
  meetingContext?: any;
  onAddContext?: () => void;
}

export const PaginatedTranscriptViewer: React.FC<PaginatedTranscriptViewerProps> = ({
  transcript,
  pageSize = 5000, // ~5KB per page
  meetingContext,
  onAddContext
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [displayMode, setDisplayMode] = useState<'raw' | 'formatted'>('raw');
  const [formattedTranscript, setFormattedTranscript] = useState<string | null>(null);
  const [isFormatting, setIsFormatting] = useState(false);

  // Helper function to clean HTML from transcript
  const cleanHTMLFromTranscript = (text: string): string => {
    const containsHTML = /<\/?[a-z][\s\S]*>/i.test(text);
    if (!containsHTML) return text;
    
    return text
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>(\s*<br\s*\/?>)*/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  // Split transcript into paragraphs
  const splitIntoParagraphs = (text: string): string[] => {
    const byBlankLines = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (byBlankLines.length > 1) return byBlankLines;

    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
    const paras: string[] = [];
    let buf = '';
    for (const s of sentences) {
      buf = buf ? `${buf} ${s}` : s;
      if (buf.length > 400) {
        paras.push(buf.trim());
        buf = '';
      }
    }
    if (buf.trim()) paras.push(buf.trim());
    return paras.length ? paras : [text];
  };

  // Handle toggle to formatted view
  const handleToggleFormatted = async (checked: boolean) => {
    if (checked) {
      setDisplayMode('formatted');
      
      // If we already have formatted content, use it
      if (formattedTranscript) return;
      
      // Otherwise, call the edge function to format
      setIsFormatting(true);
      try {
        const { data, error } = await supabase.functions.invoke('format-transcript-paragraphs', {
          body: { transcript }
        });

        if (error) {
          console.error('Format transcript error:', error);
          toast.error('Failed to format transcript');
          setDisplayMode('raw');
          return;
        }

        if (data?.formattedTranscript) {
          setFormattedTranscript(data.formattedTranscript);
          toast.success('Transcript formatted');
        } else {
          toast.error('No formatted transcript returned');
          setDisplayMode('raw');
        }
      } catch (error) {
        console.error('Error formatting transcript:', error);
        toast.error('Failed to format transcript');
        setDisplayMode('raw');
      } finally {
        setIsFormatting(false);
      }
    } else {
      setDisplayMode('raw');
    }
  };

  const handleDownloadWord = async () => {
    if (!transcript) {
      toast.error('No transcript to download');
      return;
    }

    try {
      const cleanedText = cleanHTMLFromTranscript(transcript);
      const paragraphs = splitIntoParagraphs(cleanedText);

      const headerSections = [];
      
      if (meetingContext?.title) {
        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: meetingContext.title,
                bold: true,
                size: 24,
                font: 'Calibri',
              })
            ],
            spacing: { after: 300 }
          })
        );
      }

      if (meetingContext?.date || meetingContext?.start_time) {
        let dt: Date | null = null;
        const dateStr = meetingContext?.date as string | undefined;
        const startStr = meetingContext?.start_time as string | undefined;

        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) dt = parsed;
        }

        if (!dt && startStr && !/^(\d{1,2}:\d{2})$/.test(startStr)) {
          const parsed = new Date(startStr);
          if (!isNaN(parsed.getTime())) dt = parsed;
        }

        const ordinal = (n: number) => {
          if (n > 3 && n < 21) return 'th';
          switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
        };

        let formattedDate = '';
        let formattedTime = '';

        if (dt) {
          const dayName = dt.toLocaleDateString('en-GB', { weekday: 'long' });
          const monthName = dt.toLocaleDateString('en-GB', { month: 'long' });
          const day = dt.getDate();
          const year = dt.getFullYear();
          formattedDate = `${dayName} ${day}${ordinal(day)} ${monthName} ${year}`;
          formattedTime = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) {
            const dayName = d.toLocaleDateString('en-GB', { weekday: 'long' });
            const monthName = d.toLocaleDateString('en-GB', { month: 'long' });
            const day = d.getDate();
            const year = d.getFullYear();
            formattedDate = `${dayName} ${day}${ordinal(day)} ${monthName} ${year}`;
          }
        }

        if (startStr && /^(\d{1,2}:\d{2})$/.test(startStr)) {
          formattedTime = startStr;
        }

        const dateTimeText = formattedDate
          ? `${formattedDate}${formattedTime ? ` at ${formattedTime}` : ''}`
          : (formattedTime ? `at ${formattedTime}` : '');

        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: 'Meeting Date: ', bold: true, size: 24, font: 'Calibri' }),
              new TextRun({ text: dateTimeText, size: 24, font: 'Calibri' })
            ],
            spacing: { after: 200 }
          })
        );
      }

      if (meetingContext?.meeting_type) {
        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Meeting Type: ',
                bold: true,
                size: 24,
                font: 'Calibri',
              }),
              new TextRun({
                text: meetingContext.meeting_type === 'face-to-face' ? 'Face to Face' : 'MS Teams',
                size: 24,
                font: 'Calibri',
              })
            ],
            spacing: { after: 200 }
          })
        );
      }

      if (meetingContext?.attendees && meetingContext.attendees.length > 0) {
        headerSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Attendees:',
                bold: true,
                size: 24,
                font: 'Calibri',
              })
            ],
            spacing: { after: 100 }
          })
        );

        meetingContext.attendees.forEach((attendee: string) => {
          headerSections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${attendee}`,
                  size: 24,
                  font: 'Calibri',
                })
              ],
              spacing: { after: 100 },
              indent: { left: 720 }
            })
          );
        });
      }

      headerSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '─'.repeat(40),
              size: 24,
              color: '999999',
            })
          ],
          spacing: { before: 200, after: 400 }
        })
      );

      headerSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Transcript',
              bold: true,
              size: 28,
              font: 'Calibri',
            })
          ],
          spacing: { after: 300 }
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            ...headerSections,
            ...paragraphs.map(text => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: text.trim(),
                    size: 24,
                    font: 'Calibri',
                  })
                ],
                spacing: {
                  after: 280,
                  line: 360,
                },
                alignment: 'left',
              })
            )
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      const fileName = meetingContext?.title 
        ? `${meetingContext.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-transcript.docx`
        : `transcript-${new Date().toISOString().split('T')[0]}.docx`;
      
      saveAs(blob, fileName);
      toast.success('Transcript downloaded as Word document');
    } catch (error) {
      console.error('Error downloading transcript:', error);
      toast.error('Failed to download transcript');
    }
  };

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

        <div className="flex items-center gap-3">
          {/* Formatted View Toggle */}
          <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
            <Switch 
              id="formatted-view-paginated" 
              checked={displayMode === 'formatted'}
              onCheckedChange={handleToggleFormatted}
              disabled={isFormatting}
            />
            <Label htmlFor="formatted-view-paginated" className="cursor-pointer text-sm flex items-center gap-1.5">
              {isFormatting ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-4 w-4 text-primary" />
              )}
              Formatted
            </Label>
            {displayMode === 'formatted' && (
              <Badge variant="secondary" className="text-xs">AI</Badge>
            )}
          </div>

          {onAddContext && (
            <Button
              onClick={onAddContext}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FilePlus2 className="h-4 w-4" />
              Add Context
            </Button>
          )}
          <Button
            onClick={handleDownloadWord}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Word
          </Button>
        </div>
      </div>

      <div className="min-h-[300px] max-h-[500px] overflow-y-auto mb-4">
        {isFormatting ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Formatting transcript with AI...</p>
            <p className="text-xs">This may take a few seconds</p>
          </div>
        ) : displayMode === 'formatted' && formattedTranscript ? (
          <div className="prose prose-sm max-w-none">
            {formattedTranscript.split('\n\n').filter(p => p.trim()).map((para, idx) => (
              <p key={idx} className="text-foreground mb-4 leading-relaxed" style={{ lineHeight: '1.7' }}>
                {para.trim()}
              </p>
            ))}
          </div>
        ) : currentContent ? (
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
