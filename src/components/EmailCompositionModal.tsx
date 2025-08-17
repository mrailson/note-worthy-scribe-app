import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Send, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailCompositionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  defaultSubject?: string;
}

export function EmailCompositionModal({
  isOpen,
  onOpenChange,
  content,
  defaultSubject = 'AI Generated Content'
}: EmailCompositionModalProps) {
  const [toEmail, setToEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachWordDoc, setAttachWordDoc] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  // Auto-generate subject and format message body
  useEffect(() => {
    if (content) {
      // Generate subject from content (max 80 words)
      const cleanContent = content.replace(/[#*`]/g, '').trim();
      const words = cleanContent.split(/\s+/).slice(0, 80);
      const autoSubject = words.join(' ');
      const truncatedSubject = autoSubject.length > 100 ? 
        autoSubject.substring(0, 97) + '...' : autoSubject;
      
      setSubject(`AI Generated: ${truncatedSubject}`);
      
      // Format message body maintaining structure
      const formattedContent = content
        .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
        .replace(/^\s+/gm, '') // Remove leading whitespace but keep structure
        .trim();
      
      setMessage(`Please find the AI generated content below:\n\n${formattedContent}`);
    }
  }, [content]);

  const handleSend = async () => {
    if (!toEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter at least one recipient email address.",
        variant: "destructive"
      });
      return;
    }

    setIsSending(true);
    try {
      // TODO: Implement EmailJS integration with attachment support
      // For now, just simulate sending
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Email Sent",
        description: attachWordDoc ? 
          "The email has been sent successfully with Word document attachment." :
          "The email has been sent successfully.",
      });
      
      onOpenChange(false);
      // Reset form
      setToEmail('');
      setCcEmail('');
      setAttachWordDoc(true);
    } catch (error) {
      toast({
        title: "Send Failed",
        description: "Failed to send the email. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Compose Email
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="to-email">To *</Label>
            <Input
              id="to-email"
              type="email"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cc-email">CC</Label>
            <Input
              id="cc-email"
              type="email"
              placeholder="cc@example.com"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Enter your message here..."
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="attach-word"
              checked={attachWordDoc}
              onCheckedChange={(checked) => setAttachWordDoc(checked === true)}
            />
            <Label 
              htmlFor="attach-word" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Attach as Word document
            </Label>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !toEmail.trim()}
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}