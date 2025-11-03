import { useEffect, useState } from 'react';
import { StyleCard } from './StyleCard';
import { useStyleGeneration } from './useStyleGeneration';
import { STYLE_DEFINITIONS, getAllStyleKeys } from './styleDefinitions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Loader2, Download, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { stripMarkdown } from '@/utils/stripMarkdown';
import { renderMinutesMarkdown } from '@/lib/minutesRenderer';

interface StyleGalleryContainerProps {
  meetingId: string;
  transcript: string;
  meetingContext: {
    title: string;
    date?: string;
    attendees?: string[];
    agenda?: string;
  };
  currentNotesStyle?: string;
}

export const StyleGalleryContainer = ({
  meetingId,
  transcript,
  meetingContext,
  currentNotesStyle
}: StyleGalleryContainerProps) => {
  const { previews, isGenerating, error, progress, generatePreviews, clearCache, loadFromCacheOnly } = useStyleGeneration();
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewContent, setViewContent] = useState('');
  const [viewTitle, setViewTitle] = useState('');
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);

  // Auto-load cached styles when component mounts
  useEffect(() => {
    if (meetingId && transcript && transcript.length >= 50 && !hasAttemptedLoad && !isGenerating && Object.keys(previews).length === 0) {
      console.log('🎨 Auto-checking for cached style previews');
      setHasAttemptedLoad(true);
      loadFromCacheOnly(meetingId, transcript);
    }
  }, [meetingId, transcript, hasAttemptedLoad, isGenerating, previews, loadFromCacheOnly]);

  const handleView = (content: string, styleName: string) => {
    setViewContent(content);
    setViewTitle(styleName);
    setViewModalOpen(true);
  };

  const handleCopy = (content: string) => {
    // Toast is handled in StyleCard
  };

  const handleExport = async (content: string, styleName: string) => {
    try {
      const plainText = stripMarkdown(content);
      const fileName = `${meetingContext.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${styleName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

      // Export as Word document
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
      
      // Parse content into structured paragraphs
      const lines = content.split('\n').filter(line => line.trim());
      const paragraphs = [];
      
      for (const line of lines) {
        if (line.startsWith('##')) {
          // Heading
          const text = line.replace(/^#+\s*/, '').trim();
          paragraphs.push(
            new Paragraph({
              text,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 240, after: 120 }
            })
          );
        } else if (line.startsWith('#')) {
          // Main heading
          const text = line.replace(/^#+\s*/, '').trim();
          paragraphs.push(
            new Paragraph({
              text,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 240, after: 120 }
            })
          );
        } else if (line.match(/^\d+\./)) {
          // Numbered list
          const text = line.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '').trim();
          paragraphs.push(
            new Paragraph({
              text,
              numbering: { reference: 'default-numbering', level: 0 },
              spacing: { before: 80, after: 80 }
            })
          );
        } else if (line.match(/^[-•*]/)) {
          // Bullet list
          const text = line.replace(/^[-•*]\s*/, '').replace(/\*\*/g, '').trim();
          paragraphs.push(
            new Paragraph({
              text,
              bullet: { level: 0 },
              spacing: { before: 80, after: 80 }
            })
          );
        } else if (line.trim()) {
          // Regular paragraph
          const text = line.replace(/\*\*/g, '').trim();
          paragraphs.push(
            new Paragraph({
              text,
              spacing: { before: 120, after: 120 }
            })
          );
        }
      }
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: styleName,
              heading: HeadingLevel.TITLE,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: meetingContext.title,
              spacing: { after: 400 }
            }),
            ...paragraphs
          ]
        }]
      });
      
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${fileName}.docx`);
      toast.success('Exported as Word document');
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Failed to export');
    }
  };

  const handleGenerate = () => {
    if (!transcript || transcript.length < 50) {
      toast.error('Please load the meeting transcript first');
      return;
    }
    generatePreviews(meetingId, transcript, meetingContext);
  };

  const handleRetry = () => {
    handleGenerate();
  };

  const handleClearCache = () => {
    clearCache(meetingId);
  };

  const handleCopyFullContent = () => {
    const plainText = stripMarkdown(viewContent);
    navigator.clipboard.writeText(plainText);
    toast.success('Copied full content to clipboard');
  };

  const styleKeys = getAllStyleKeys();
  const previewCount = Object.keys(previews).length;
  const progressPercentage = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="h-full flex flex-col p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Alternative Meeting Note Styles</h2>
          <p className="text-sm text-muted-foreground">
            {previewCount > 0 
              ? `${previewCount} styles available` 
              : 'Click "Generate Styles" to begin'}
          </p>
        </div>
        {previewCount === 0 && !isGenerating && !error && (
          <Button
            onClick={handleGenerate}
            variant="default"
            size="lg"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Styles
          </Button>
        )}
        {previewCount > 0 && !isGenerating && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCache}
            >
              Clear Cache
            </Button>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {isGenerating && progress && (
        <div className="space-y-3">
          <Progress value={progressPercentage} className="w-full" />
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-muted-foreground">
              Generating Styles - This may take a couple of minutes
            </p>
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_ease-in-out_0s_infinite]"></span>
              <span className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_ease-in-out_0.2s_infinite]"></span>
              <span className="w-2 h-2 bg-primary rounded-full animate-[bounce_1s_ease-in-out_0.4s_infinite]"></span>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Styles Grid */}
      <ScrollArea className="flex-1">
        {isGenerating && previewCount === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {styleKeys.map((key) => (
              <StyleCard
                key={key}
                style={STYLE_DEFINITIONS[key]}
                content={null}
                isLoading={true}
                onView={handleView}
                onCopy={handleCopy}
                onExport={handleExport}
              />
            ))}
          </div>
        ) : previewCount > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
            {styleKeys.map((key) => (
              <StyleCard
                key={key}
                style={STYLE_DEFINITIONS[key]}
                content={previews[key] || null}
                isLoading={!previews[key]}
                isCurrentStyle={currentNotesStyle === previews[key]}
                onView={handleView}
                onCopy={handleCopy}
                onExport={handleExport}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4 max-w-md">
              <Sparkles className="h-12 w-12 mx-auto text-primary" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Ready to Generate Professional Styles</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Click "Generate Styles" to create 10 different professional meeting note formats tailored for healthcare practice managers and GPs.
                </p>
                <Button onClick={handleGenerate} size="lg">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate 10 Professional Styles
                </Button>
              </div>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* View Full Content Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewTitle}</DialogTitle>
            <DialogDescription>
              Full content for {viewTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFullContent}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport(viewContent, viewTitle)}
            >
              <Download className="h-4 w-4 mr-1" />
              Export Word
            </Button>
          </div>
          <ScrollArea className="flex-1 border rounded-md p-4 bg-background">
            <div 
              className="max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: renderMinutesMarkdown(viewContent) 
              }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
