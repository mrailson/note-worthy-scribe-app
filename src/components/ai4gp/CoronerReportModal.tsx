import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  FolderOpen,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Download,
  RefreshCw,
  FileImage,
  File,
} from 'lucide-react';
import { useFolderDocumentAnalysis, DocumentFile } from '@/hooks/useFolderDocumentAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { generateWordDocument } from '@/utils/documentGenerators';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';

interface CoronerReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CoronerReportModal: React.FC<CoronerReportModalProps> = ({
  open,
  onOpenChange,
}) => {
  const {
    isSupported,
    isProcessing,
    folderName,
    documents,
    combinedText,
    selectAndProcessFolder,
    reset,
  } = useFolderDocumentAnalysis();

  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string | null>(null);

  const handleClose = () => {
    reset();
    setAdditionalContext('');
    setGeneratedReport(null);
    onOpenChange(false);
  };

  const handleGenerateReport = async () => {
    if (!combinedText) {
      toast.error('No documents parsed yet');
      return;
    }

    setIsGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-coroner-report', {
        body: {
          documentContent: combinedText,
          additionalContext: additionalContext.trim() || undefined,
        },
      });

      if (error) throw error;

      // Check for validation rejection
      if (data.error === 'Document validation failed' && data.validationDetails) {
        const details = data.validationDetails;
        toast.error('Document Validation Failed', {
          description: details.message,
          duration: 8000,
        });
        console.warn('Document validation rejected:', details);
        return;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedReport(data.report);
      toast.success('Coroner\'s report generated');
    } catch (err) {
      console.error('Report generation error:', err);
      toast.error('Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyReport = async () => {
    if (!generatedReport) return;
    await navigator.clipboard.writeText(generatedReport);
    toast.success('Report copied to clipboard');
  };

  const handleDownloadWord = async () => {
    if (!generatedReport) return;
    try {
      await generateWordDocument(generatedReport, 'Coroners_Report');
      toast.success('Word document downloaded');
    } catch (err) {
      toast.error('Failed to download document');
    }
  };

  const getFileIcon = (type: DocumentFile['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'word':
        return <File className="h-4 w-4 text-blue-500" />;
      case 'image':
        return <FileImage className="h-4 w-4 text-green-500" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusIcon = (status: DocumentFile['status']) => {
    switch (status) {
      case 'pending':
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />;
      case 'parsing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'parsed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const parsedCount = documents.filter(d => d.status === 'parsed').length;
  const totalCount = documents.length;
  const progress = totalCount > 0 ? (parsedCount / totalCount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Coroner's Report Generator
          </DialogTitle>
          <DialogDescription>
            Select a folder containing case documents (PDF, Word, images, TXT, RTF, emails) to generate a structured coroner's report.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {!isSupported && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Folder selection requires Chrome or Edge browser. This feature is not available in your current browser.
              </p>
            </div>
          )}

          {!generatedReport ? (
            <>
              {/* Folder Selection */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={selectAndProcessFolder}
                  disabled={!isSupported || isProcessing}
                  variant={folderName ? 'outline' : 'default'}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="h-4 w-4" />
                  )}
                  {folderName ? 'Change Folder' : 'Select Folder'}
                </Button>
                
                {folderName && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="font-mono">
                      {folderName}
                    </Badge>
                    <span className="text-muted-foreground">
                      {totalCount} document{totalCount !== 1 ? 's' : ''} found
                    </span>
                  </div>
                )}
              </div>

              {/* Document List */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Documents</Label>
                    {isProcessing && (
                      <span className="text-xs text-muted-foreground">
                        Parsing {parsedCount} of {totalCount}...
                      </span>
                    )}
                  </div>
                  
                  {isProcessing && <Progress value={progress} className="h-2" />}
                  
                  <ScrollArea className="h-40 border rounded-lg p-2">
                    <div className="space-y-1">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded text-sm",
                            doc.status === 'failed' && 'bg-destructive/10',
                            doc.status === 'parsed' && 'bg-green-500/10'
                          )}
                        >
                          {getFileIcon(doc.type)}
                          <span className="flex-1 truncate">{doc.name}</span>
                          {getStatusIcon(doc.status)}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Additional Context */}
              {combinedText && (
                <div className="space-y-2">
                  <Label htmlFor="context" className="text-sm font-medium">
                    Additional Context (optional)
                  </Label>
                  <Textarea
                    id="context"
                    placeholder="Add any additional context, specific questions to address, or areas of focus for the report..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    className="h-24 resize-none"
                  />
                </div>
              )}

              {/* Generate Button */}
              {combinedText && (
                <Button
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full gap-2"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" />
                      Generate Coroner's Report
                    </>
                  )}
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Generated Report */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Generated Report</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGeneratedReport(null)}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyReport}
                    className="gap-1"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadWord}
                    className="gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Word
                  </Button>
                </div>
              </div>
              
              <ScrollArea className="h-[50vh] border rounded-lg p-4 bg-muted/30">
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ 
                    __html: renderNHSMarkdown(generatedReport || '', { enableNHSStyling: true }) 
                  }}
                />
              </ScrollArea>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
