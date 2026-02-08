import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Volume2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface AudioAIReviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  review: string;
}

export function AudioAIReviewDialog({ isOpen, onOpenChange, fileName, review }: AudioAIReviewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Volume2 className="h-5 w-5 text-primary" />
            AI Audio Evidence Review
          </DialogTitle>
          <DialogDescription className="text-sm">
            <span className="font-medium">{fileName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <div className="bg-muted/50 p-6 rounded-lg border">
            <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert">
              <ReactMarkdown>{review}</ReactMarkdown>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(review);
              toast.success('Copied to clipboard');
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
