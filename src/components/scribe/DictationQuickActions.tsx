import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Copy, Trash2, Save, Clock, Type, Sparkles, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

interface DictationQuickActionsProps {
  content: string;
  wordCount: number;
  duration: number;
  formatDuration: (secs: number) => string;
  onCopyAll: () => void;
  
  onClear: () => void;
  onSave: () => void;
  onFormatAndClean: () => Promise<void>;
  isRecording: boolean;
  isFormatting: boolean;
  currentSessionId: string | null;
}

export function DictationQuickActions({
  content,
  wordCount,
  duration,
  formatDuration,
  onCopyAll,
  
  onClear,
  onSave,
  onFormatAndClean,
  isRecording,
  isFormatting,
  currentSessionId,
}: DictationQuickActionsProps) {
  const hasContent = content.trim().length > 0;

  const handleDownloadWord = async () => {
    if (!hasContent) return;

    const lines = content.split('\n');
    const children: Paragraph[] = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      // Check if it's a header (starts with ## or is all caps and short)
      if (trimmedLine.startsWith('## ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('## ', ''),
                bold: true,
                size: 28,
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (trimmedLine.startsWith('# ')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace('# ', ''),
                bold: true,
                size: 32,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 150 },
          })
        );
      } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        // Bold text (like section headers)
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine.replace(/\*\*/g, ''),
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (trimmedLine === '') {
        // Empty line
        children.push(new Paragraph({ children: [] }));
      } else {
        // Regular paragraph
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                size: 24,
              }),
            ],
            spacing: { after: 120 },
          })
        );
      }
    });

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const timestamp = new Date().toISOString().slice(0, 10);
    saveAs(blob, `dictation-${timestamp}.docx`);
  };

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border',
      isRecording && 'bg-primary/5 border-primary/20'
    )}>
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Type className="h-3.5 w-3.5" />
          <span>{wordCount} words</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>{formatDuration(duration)}</span>
        </div>
        
        {/* Format & Clean Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onFormatAndClean}
              disabled={!hasContent || isRecording || isFormatting}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
            >
              {isFormatting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Format & Clean (AI)</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="h-6 hidden sm:block" />

      {/* Copy Actions */}
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyAll}
          disabled={!hasContent}
          className="gap-1.5"
        >
          <Copy className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copy All</span>
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadWord}
              disabled={!hasContent}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Word</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Download as Word document</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {currentSessionId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            disabled={!hasContent || isRecording}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!hasContent && !currentSessionId}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      </div>
    </div>
  );
}
