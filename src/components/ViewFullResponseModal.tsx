import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye, Copy, Check } from 'lucide-react';

interface ViewFullResponseModalProps {
  responseText: string;
  staffName: string;
}

export const ViewFullResponseModal: React.FC<ViewFullResponseModalProps> = ({
  responseText,
  staffName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(responseText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy response:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="text-xs text-primary hover:text-primary/80 mt-1 flex items-center gap-1 transition-colors">
          <Eye className="h-3 w-3" />
          View full response
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Full Response from {staffName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-auto max-h-[60vh] p-4 border rounded-md">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {responseText}
          </div>
        </div>
        
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {responseText.split(' ').length} words • {responseText.length} characters
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Response
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};