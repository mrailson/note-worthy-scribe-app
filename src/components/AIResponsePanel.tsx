import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SafeMessageRenderer } from './SafeMessageRenderer';
import { EmailCompositionModal } from './EmailCompositionModal';
import { Copy, Sparkles, Maximize2, X, Download, Printer, Mail } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { toast } from "sonner";

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
  
  // Strip HTML tags for plain text versions
  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  };

  // Handle Word document export
  const handleWordExport = async () => {
    try {
      const plainText = stripHtml(response);
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "AI Assistant Response",
                  bold: true,
                  size: 32,
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: "" })],
            }),
            ...plainText.split('\n').map(line => 
              new Paragraph({
                children: [new TextRun({ text: line || " " })],
              })
            ),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `AI-Response-${Date.now()}.docx`);
      toast.success("Word document downloaded successfully");
    } catch (error) {
      console.error('Error exporting to Word:', error);
      toast.error("Failed to export Word document");
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
  const handleEmailToPatient = () => {
    setIsEmailModalOpen(true);
  };
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[75vw] min-w-[1000px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            AI Assistant Response
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
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
              onClick={handleEmailToPatient}
              className="flex-none"
            >
              <Mail className="h-4 w-4 mr-2" />
              Email to Patient
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-120px)] pr-4">
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <div className="ai-response-content space-y-4 p-4 bg-muted/30 rounded-lg border">
                <SafeMessageRenderer content={
                  response
                    .replace(/^```html\s*/i, '')     // Remove opening ```html
                    .replace(/^```\s*/i, '')         // Remove opening ```
                    .replace(/\s*```\s*$/i, '')      // Remove closing ```
                    .replace(/^html\s*/i, '')        // Remove standalone "html" at start
                    .replace(/\s*```[a-z]*\s*$/gi, '') // Remove any trailing ``` with optional language
                    .trim()
                } />
              </div>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
      
      {/* Email Composition Modal */}
      <EmailCompositionModal
        isOpen={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
        defaultContent={response}
        defaultSubject="Medical Consultation Information"
      />
    </Sheet>
  );
};