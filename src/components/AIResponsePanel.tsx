import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { renderNHSMarkdown } from '@/lib/nhsMarkdownRenderer';
import { Copy, Sparkles, Maximize2, X, Download, Printer, Mail } from 'lucide-react';
import { showToast } from "@/utils/toastWrapper";
import { useIsMobile } from '@/hooks/use-mobile';
import { useAutoEmail } from '@/hooks/useAutoEmail';
import { generateCleanAIResponseDocument } from '@/utils/cleanWordExport';

interface AIResponsePanelProps {
  response: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => void;
}

export const AIResponsePanel: React.FC<AIResponsePanelProps> = ({
  response,
  isOpen,
  onOpenChange,
  onCopy
}) => {
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { sendEmailAutomatically, isSending } = useAutoEmail();
  
  // Strip HTML tags for plain text versions
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  };

  // Handle Word document export with clean formatting
  const handleWordExport = async () => {
    try {
      await generateCleanAIResponseDocument(response, "AI Assistant Response");
      showToast.success("Word document downloaded successfully", { section: 'ai4gp' });
    } catch (error) {
      console.error('Error exporting to Word:', error);
      showToast.error("Failed to export Word document", { section: 'ai4gp' });
    }
  };

  // Handle print
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const cleanedResponse = response
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .replace(/^html\s*/i, '')
        .replace(/\s*```[a-z]*\s*$/gi, '')
        .trim();

      printWindow.document.write(`
        <html>
          <head>
            <title>AI Assistant Response</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
              h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
              p { margin-bottom: 10px; }
              strong { font-weight: bold; }
              em { font-style: italic; }
              ul, ol { margin-left: 20px; }
              @media print { body { margin: 20px; } }
            </style>
          </head>
          <body>
            <h1>AI Assistant Response</h1>
            <div>${cleanedResponse}</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Handle email to patient
  const handleEmail = async () => {
    await sendEmailAutomatically(response, `Medical Consultation Notes - ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`);
  };
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="flex flex-col overflow-hidden w-full sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] p-4 sm:p-6 pb-[max(env(safe-area-inset-bottom),0px)] h-[85dvh] sm:h-full rounded-t-xl sm:rounded-none"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            AI Assistant Response
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-4 sm:mt-6 flex-1 min-h-0 flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onCopy}
              className="flex-none"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Response
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleWordExport}
              className="flex-none"
            >
              <Download className="h-4 w-4 mr-2" />
              Word Download
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="flex-none"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleEmail}
              disabled={isSending}
              className="flex-none disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Email to Me
                </>
              )}
            </Button>
          </div>
          
          <ScrollArea className="flex-1 h-full min-h-0 pr-2 sm:pr-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="ai-response-content space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: renderNHSMarkdown(
                      response
                        .replace(/^```html\s*/i, '')     // Remove opening ```html
                        .replace(/^```\s*/i, '')         // Remove opening ```
                        .replace(/\s*```\s*$/i, '')      // Remove closing ```
                        .replace(/^html\s*/i, '')        // Remove standalone "html" at start
                        .replace(/\s*```[a-z]*\s*$/gi, '') // Remove any trailing ``` with optional language
                        .trim(),
                      { enableNHSStyling: true }
                    ) 
                  }} 
                />
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
      
    </Sheet>
  );
};