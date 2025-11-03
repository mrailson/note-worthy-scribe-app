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
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { stripMarkdown } from '@/utils/stripMarkdown';
import ReactMarkdown from 'react-markdown';

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
  const { previews, isGenerating, error, progress, generatePreviews, clearCache } = useStyleGeneration();
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewContent, setViewContent] = useState('');
  const [viewTitle, setViewTitle] = useState('');

  // Don't auto-generate - wait for user interaction

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

      // Export as PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      doc.setFontSize(16);
      doc.text(styleName, margin, margin);
      doc.setFontSize(10);
      doc.text(meetingContext.title, margin, margin + 10);
      
      const lines = doc.splitTextToSize(plainText, maxWidth);
      doc.setFontSize(11);
      doc.text(lines, margin, margin + 20);
      
      doc.save(`${fileName}.pdf`);
      toast.success('Exported as PDF');
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
          <h2 className="text-xl font-semibold">Professional Note Styles</h2>
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
        <div className="space-y-2">
          <Progress value={progressPercentage} className="w-full" />
          <p className="text-sm text-muted-foreground text-center">
            Generating styles: {progress.current} of {progress.total} complete
          </p>
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
              Export PDF
            </Button>
          </div>
          <ScrollArea className="flex-1 border rounded-md p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{viewContent}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
