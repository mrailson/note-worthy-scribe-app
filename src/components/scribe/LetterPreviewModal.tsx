/**
 * Letter Preview Modal Component
 * Displays AI-generated letters in a professional NHS-style format
 */

import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { Download, Mail, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseLetter, cleanMarkdownText, isLetterFormat } from '@/utils/letterParser';
import { cn } from '@/lib/utils';

interface LetterPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onDownload: (content: string) => void;
  onEmail: (content: string) => void;
  practiceContext?: {
    practiceName?: string;
    practiceAddress?: string;
    practicePhone?: string;
    practiceEmail?: string;
    logoUrl?: string;
    userFullName?: string;
  };
}

export const LetterPreviewModal: React.FC<LetterPreviewModalProps> = ({
  open,
  onOpenChange,
  content,
  onDownload,
  onEmail,
  practiceContext
}) => {
  const parsed = useMemo(() => parseLetter(content), [content]);
  const isLetter = useMemo(() => isLetterFormat(content), [content]);
  
  // Format current date if not detected from content
  const displayDate = parsed.date || format(new Date(), "d MMMM yyyy");
  
  // Get practice details from context
  const practiceName = practiceContext?.practiceName;
  const practiceAddress = practiceContext?.practiceAddress;
  const practicePhone = practiceContext?.practicePhone;
  const practiceEmail = practiceContext?.practiceEmail;
  const logoUrl = practiceContext?.logoUrl;
  
  // Render letter format preview
  const renderLetterPreview = () => (
    <div className="bg-white rounded-lg shadow-lg max-w-3xl mx-auto">
      {/* Letterhead */}
      <div className="border-b-2 border-primary pt-6 pb-4 px-8">
        {/* Logo */}
        {logoUrl && (
          <div className="flex justify-center mb-3">
            <img 
              src={logoUrl} 
              alt="Practice logo" 
              className="h-14 w-auto object-contain"
            />
          </div>
        )}
        
        {/* Practice name */}
        {practiceName && (
          <h1 className="text-center text-lg font-bold text-primary mb-1">
            {practiceName}
          </h1>
        )}
        
        {/* Practice address */}
        {practiceAddress && (
          <p className="text-center text-sm text-muted-foreground">
            {practiceAddress}
          </p>
        )}
        
        {/* Contact details */}
        {(practicePhone || practiceEmail) && (
          <p className="text-center text-sm text-muted-foreground mt-1">
            {[
              practicePhone && `Tel: ${practicePhone}`,
              practiceEmail && practiceEmail
            ].filter(Boolean).join(' | ')}
          </p>
        )}
      </div>
      
      {/* Letter content */}
      <div className="px-8 py-6 min-h-[400px]">
        {/* Date - right aligned */}
        <p className="text-right text-sm text-foreground mb-6">
          {displayDate}
        </p>
        
        {/* Recipient address */}
        {parsed.headerSection.toLines && parsed.headerSection.toLines.length > 0 && (
          <div className="mb-6">
            {parsed.headerSection.toLines.map((line, idx) => (
              <p 
                key={idx} 
                className={cn(
                  "text-sm",
                  idx === 0 && "font-semibold"
                )}
              >
                {line}
              </p>
            ))}
          </div>
        )}
        
        {/* Subject line */}
        {parsed.subject && (
          <p className="font-semibold text-sm mb-4">
            Re: {parsed.subject}
          </p>
        )}
        
        {/* Salutation */}
        {parsed.salutation && (
          <p className="text-sm mb-4">
            {parsed.salutation},
          </p>
        )}
        
        {/* Body paragraphs */}
        <div className="space-y-4 mb-6">
          {parsed.bodyParagraphs.map((paragraph, idx) => (
            <p key={idx} className="text-sm leading-relaxed text-justify">
              {paragraph}
            </p>
          ))}
        </div>
        
        {/* Closing */}
        <p className="text-sm mt-8">
          {parsed.closing || 'Yours sincerely'},
        </p>
        
        {/* Signature block */}
        <div className="mt-10">
          {(parsed.signature.name || practiceContext?.userFullName) && (
            <p className="text-sm font-semibold">
              {parsed.signature.name || practiceContext?.userFullName}
            </p>
          )}
          {parsed.signature.qualifications && (
            <p className="text-sm text-muted-foreground">
              {parsed.signature.qualifications}
            </p>
          )}
          {parsed.signature.title && (
            <p className="text-sm">
              {parsed.signature.title}
            </p>
          )}
          {(parsed.signature.organisation || practiceName) && (
            <p className="text-sm text-muted-foreground">
              {parsed.signature.organisation || practiceName}
            </p>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="border-t border-border px-8 py-3 bg-muted/30">
        <p className="text-xs text-center text-muted-foreground">
          {[practiceName, practicePhone, practiceEmail].filter(Boolean).join(' | ')}
        </p>
      </div>
    </div>
  );
  
  // Render plain text preview (for non-letter content)
  const renderPlainPreview = () => (
    <div className="bg-white rounded-lg shadow-lg max-w-3xl mx-auto px-8 py-6">
      <div className="prose prose-sm max-w-none dark:prose-invert">
        {content.split('\n\n').map((paragraph, idx) => (
          <p key={idx} className="mb-4 leading-relaxed">
            {cleanMarkdownText(paragraph)}
          </p>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {isLetter ? 'Letter Preview' : 'Document Preview'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownload(content)}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEmail(content)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(95vh-120px)]">
          <div className="p-6 bg-muted/20">
            {isLetter ? renderLetterPreview() : renderPlainPreview()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
